#include "job.h"
#include <algorithm>
#include <array>
#include <deque>
#include <memory>
namespace atlas::job {
namespace {
constexpr ULONGLONG kSetupMs=5000, kRunMs=120000, kStopMs=5000, kEmptyMs=2000;
bool hex(wchar_t c){return(c>=L'0'&&c<=L'9')||(c>=L'a'&&c<=L'f');}
std::vector<std::uint8_t> nonce(const std::wstring& s){
  if(s.size()!=64||!std::all_of(s.begin(),s.end(),hex))throw ProtocolError("nonce format");
  auto digit=[](wchar_t c){return c<=L'9'?c-L'0':c-L'a'+10;};std::vector<std::uint8_t> bytes;
  for(std::size_t i=0;i<s.size();i+=2)bytes.push_back(static_cast<std::uint8_t>((digit(s[i])<<4)|digit(s[i+1])));return bytes;
}
void pipe_name(const std::wstring& s){const std::wstring prefix=L"\\\\.\\pipe\\atlas-agent-job-";if(s.size()!=prefix.size()+32||s.substr(0,prefix.size())!=prefix||!std::all_of(s.begin()+static_cast<std::ptrdiff_t>(prefix.size()),s.end(),hex))throw ProtocolError("pipe format");}
struct HelperStdio {
  std::array<HANDLE,3> handles{GetStdHandle(STD_INPUT_HANDLE),GetStdHandle(STD_OUTPUT_HANDLE),GetStdHandle(STD_ERROR_HANDLE)};bool closed=false;
  HelperStdio(){for(auto handle:handles)noninherit(handle);}
  ~HelperStdio(){close();}
  Stdio streams()const{return{handles[0],handles[1],handles[2]};}
  void close(){if(closed)return;closed=true;for(std::size_t i=0;i<handles.size();++i)if(std::find(handles.begin(),handles.begin()+static_cast<std::ptrdiff_t>(i),handles[i])==handles.begin()+static_cast<std::ptrdiff_t>(i))CloseHandle(handles[i]);SetStdHandle(STD_INPUT_HANDLE,INVALID_HANDLE_VALUE);SetStdHandle(STD_OUTPUT_HANDLE,INVALID_HANDLE_VALUE);SetStdHandle(STD_ERROR_HANDLE,INVALID_HANDLE_VALUE);}
};
// Read and write both use overlapped operations. A blocked peer cannot block root monitoring.
class Channel {
  Handle pipe_,read_event_,write_event_;OVERLAPPED read_{},write_{};
  std::array<std::uint8_t,65536> buffer_{};bool reading_=false,writing_=false;
  Decoder decoder_;std::deque<std::vector<std::uint8_t>> queue_;std::size_t written_=0;
  std::vector<Frame> immediate_;
  void accept(DWORD size){if(!size)throw WinError("owner EOF",ERROR_BROKEN_PIPE);auto frames=decoder_.feed(std::vector<std::uint8_t>(buffer_.begin(),buffer_.begin()+size));immediate_.insert(immediate_.end(),frames.begin(),frames.end());}
  void begin_read(){
    ResetEvent(read_event_.get());read_={};read_.hEvent=read_event_.get();DWORD size=0;
    if(ReadFile(pipe_.get(),buffer_.data(),static_cast<DWORD>(buffer_.size()),&size,&read_)){reading_=false;accept(size);}
    else if(GetLastError()==ERROR_IO_PENDING)reading_=true;else throw WinError("control read");
  }
  void begin_write(){
    while(!writing_&&!queue_.empty()){
      ResetEvent(write_event_.get());write_={};write_.hEvent=write_event_.get();DWORD size=0;auto& frame=queue_.front();
      if(WriteFile(pipe_.get(),frame.data()+written_,static_cast<DWORD>(frame.size()-written_),&size,&write_)){advance(size);}
      else if(GetLastError()==ERROR_IO_PENDING)writing_=true;else throw WinError("control write");
    }
  }
  void advance(DWORD size){if(!size)throw WinError("control short write",ERROR_BROKEN_PIPE);written_+=size;if(written_==queue_.front().size()){queue_.pop_front();written_=0;}}
public:
  explicit Channel(const std::wstring& name,ULONGLONG deadline){
    for(;;){pipe_.reset(CreateFileW(name.c_str(),GENERIC_READ|GENERIC_WRITE,0,nullptr,OPEN_EXISTING,FILE_FLAG_OVERLAPPED,nullptr));if(pipe_.valid())break;auto error=GetLastError();if((error!=ERROR_PIPE_BUSY&&error!=ERROR_FILE_NOT_FOUND)||GetTickCount64()>=deadline)throw WinError("control connect",error);Sleep(20);}
    noninherit(pipe_.get());read_event_.reset(CreateEventW(nullptr,TRUE,FALSE,nullptr));write_event_.reset(CreateEventW(nullptr,TRUE,FALSE,nullptr));if(!read_event_.valid()||!write_event_.valid())throw WinError("control events");noninherit(read_event_.get());noninherit(write_event_.get());
  }
  ~Channel(){finish(GetTickCount64()+kStopMs);}
  void send(Type type,const std::vector<std::uint8_t>& payload={}){if(queue_.size()>=8)throw ProtocolError("status queue budget");queue_.push_back(encode_frame(type,payload));begin_write();}
  std::vector<Frame> poll(){
    if(writing_){DWORD size=0;if(GetOverlappedResult(pipe_.get(),&write_,&size,FALSE)){writing_=false;advance(size);}else if(GetLastError()!=ERROR_IO_INCOMPLETE)throw WinError("control write completion");}begin_write();
    if(reading_){DWORD size=0;if(GetOverlappedResult(pipe_.get(),&read_,&size,FALSE)){reading_=false;accept(size);}else if(GetLastError()!=ERROR_IO_INCOMPLETE)throw WinError("control read completion");}
    // One 64KiB read per poll; parser itself bounds pending bytes to one 1MiB frame.
    if(!reading_)begin_read();auto out=std::move(immediate_);immediate_.clear();return out;
  }
  bool write_idle()const{return queue_.empty()&&!writing_;}
  void wait(HANDLE root,DWORD timeout){std::array<HANDLE,3> handles{};DWORD n=0;if(reading_)handles[n++]=read_event_.get();if(writing_)handles[n++]=write_event_.get();if(root)handles[n++]=root;if(n){auto result=WaitForMultipleObjects(n,handles.data(),FALSE,timeout);if(result==WAIT_FAILED)throw WinError("control wait");}else Sleep(timeout);}
  bool peer_present()const{DWORD available=0;return PeekNamedPipe(pipe_.get(),nullptr,0,nullptr,&available,nullptr)!=FALSE;}
  // Cancelled OVERLAPPED storage remains live through a bounded completion wait.
  void finish(ULONGLONG deadline){
    if(pipe_.valid())CancelIoEx(pipe_.get(),nullptr);
    for(auto* operation:{&read_,&write_}){
      const bool pending=operation==&read_?reading_:writing_;if(!pending)continue;
      auto now=GetTickCount64();if(now>=deadline||WaitForSingleObject(operation->hEvent,static_cast<DWORD>(deadline-now))!=WAIT_OBJECT_0)ExitProcess(73);
      DWORD ignored=0;(void)GetOverlappedResult(pipe_.get(),operation,&ignored,FALSE);
    }reading_=false;writing_=false;
  }
};
int run(const std::wstring& name,const std::wstring& secret){
  const auto setup_deadline=GetTickCount64()+kSetupMs;pipe_name(name);auto hello=std::vector<std::uint8_t>{};append_u32(hello,kProtocol);auto bytes=nonce(secret);hello.insert(hello.end(),bytes.begin(),bytes.end());
  HelperStdio streams;OwnedJob job;Channel channel(name,setup_deadline);channel.send(Type::Hello,hello);
  bool launched=false,resumed=false,stopping=false,root_reported=false,failed=false;ULONGLONG run_deadline=0,stop_deadline=0;
  auto stop=[&](){if(!stopping){stopping=true;stop_deadline=GetTickCount64()+kStopMs;}streams.close();};
  auto error=[&](std::uint32_t reason,DWORD code){failed=true;stop();std::vector<std::uint8_t> payload;append_u32(payload,reason);append_u32(payload,code);try{channel.send(Type::Error,payload);}catch(const std::exception&){}};
  auto receive=[&](const std::vector<Frame>& frames){
    // STOP in the same available batch wins before creation, even when it follows LAUNCH.
    if(std::any_of(frames.begin(),frames.end(),[](const auto& frame){return frame.type==Type::Stop;}))stop();
    for(const auto& frame:frames){if(frame.type==Type::Stop)continue;if(stopping&&frame.type==Type::Launch&&!launched){(void)parse_launch(frame.payload);launched=true;continue;}if(frame.type!=Type::Launch||launched||stopping)throw ProtocolError("control state");auto launch=parse_launch(frame.payload);launched=true;job.create(launch,streams.streams());streams.close();}
  };
  for(;;){
    try{
      auto frames=channel.poll();receive(frames);
      if(launched&&!resumed&&!stopping){
        // Observe ready control/owner EOF once more while the root is suspended.
        if(!channel.peer_present())stop();else receive(channel.poll());
        if(GetTickCount64()>=setup_deadline)error(3,WAIT_TIMEOUT);
        if(!stopping){job.resume();resumed=true;run_deadline=GetTickCount64()+kRunMs;std::vector<std::uint8_t> ready;append_u32(ready,job.root_id());channel.send(Type::Ready,ready);}
      }
      if(job.root()&&!root_reported&&WaitForSingleObject(job.root(),0)==WAIT_OBJECT_0){DWORD code=0;if(!GetExitCodeProcess(job.root(),&code))throw WinError("root exit");root_reported=true;std::vector<std::uint8_t> exit;append_u32(exit,code);channel.send(Type::RootExit,exit);stop();}
      const auto now=GetTickCount64();if(!stopping&&((!resumed&&now>=setup_deadline)||(resumed&&now>=run_deadline)))error(3,WAIT_TIMEOUT);
      if(stopping){
        const auto empty_deadline=std::min(stop_deadline,GetTickCount64()+kEmptyMs);
        if(!job.stop(empty_deadline)){error(4,WAIT_TIMEOUT);channel.finish(stop_deadline);return 1;}
        if(job.root()&&!root_reported&&WaitForSingleObject(job.root(),0)==WAIT_OBJECT_0){DWORD code=0;if(GetExitCodeProcess(job.root(),&code)){std::vector<std::uint8_t> exit;append_u32(exit,code);channel.send(Type::RootExit,exit);}root_reported=true;}
        channel.send(Type::JobEmpty);
        while(!channel.write_idle()&&GetTickCount64()<stop_deadline){(void)channel.poll();channel.wait(nullptr,20);}
        const auto delivered=channel.write_idle();channel.finish(stop_deadline);return delivered&&!failed?0:1;
      }
      channel.wait(resumed?job.root():nullptr,20);
    }catch(const ProtocolError&){error(1,ERROR_INVALID_DATA);}catch(const WinError& fault){error(2,fault.code);}
    if(stopping){
      // Owner disconnect or invalid protocol: terminate only our private Job; absence of
      // an acknowledgement remains an unverified outcome for the future Node adapter.
      try{(void)job.stop(std::min(stop_deadline,GetTickCount64()+kEmptyMs));}catch(const std::exception&){}
      channel.finish(stop_deadline);return 1;
    }
  }
}
}
}
int wmain(int argc,wchar_t** argv){
  // Release helper has no fault injection switches, target argv, or shell command option.
  if(argc!=5||std::wstring(argv[1])!=L"--pipe"||std::wstring(argv[3])!=L"--nonce")return 2;
  try{return atlas::job::run(argv[2],argv[4]);}catch(const std::exception&){return 1;}
}
