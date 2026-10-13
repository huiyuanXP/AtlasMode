// Owned Win32 mechanism gates. No public native capability or existing guard is used.
#include "../job.h"
#include <iostream>
#include <filesystem>
#include <stdexcept>
#include <array>
#include <string>
#include <random>
#include <deque>
using namespace atlas::job;
static void check(bool result, const char* message) { if(!result)throw std::runtime_error(message); }
static std::u16string u16(const std::wstring& s){return {reinterpret_cast<const char16_t*>(s.data()),s.size()};}
static std::string read_line(HANDLE pipe,ULONGLONG deadline){
  std::string line;
  while(GetTickCount64()<deadline){DWORD available=0;if(!PeekNamedPipe(pipe,nullptr,0,nullptr,&available,nullptr))throw WinError("fixture output EOF");if(available){char c=0;DWORD count=0;if(!ReadFile(pipe,&c,1,&count,nullptr)||count!=1)throw WinError("fixture read");if(c=='\n')return line;line.push_back(c);if(line.size()>128)throw std::runtime_error("fixture output budget");}else Sleep(10);}
  throw std::runtime_error("fixture observer deadline");
}
static Handle duplicate_observer(HANDLE source){HANDLE out=nullptr;check(DuplicateHandle(GetCurrentProcess(),source,GetCurrentProcess(),&out,SYNCHRONIZE|PROCESS_QUERY_LIMITED_INFORMATION,FALSE,0)!=FALSE,"observer duplication");return Handle(out);}
static std::wstring random_hex(std::size_t count){std::random_device generator;const wchar_t digits[]=L"0123456789abcdef";std::wstring value;for(std::size_t i=0;i<count;++i)value.push_back(digits[generator()%16]);return value;}

// Test-only owner: no outstanding operation may outlive its pipe/event/OVERLAPPED.
// The receipt is an external test witness, never part of production DTO/runtime state.
struct ConnectReceipt { bool pending_started=false;bool completion_observed=false;DWORD completion_error=ERROR_IO_INCOMPLETE; };
struct ConnectTimeout:std::runtime_error { ConnectTimeout():std::runtime_error("owned connect deadline"){} };
class PendingConnect {
  Handle pipe_,event_;
  OVERLAPPED operation_{};
  bool pending_=false;
  ConnectReceipt* receipt_=nullptr;
  static bool terminal_error(DWORD error) noexcept {
    return error==ERROR_OPERATION_ABORTED||error==ERROR_BROKEN_PIPE||error==ERROR_NO_DATA||error==ERROR_PIPE_NOT_CONNECTED;
  }
  void observed(DWORD error) noexcept {
    pending_=false;
    if(receipt_){receipt_->completion_observed=true;receipt_->completion_error=error;}
  }
public:
  explicit PendingConnect(const std::wstring& name,ConnectReceipt* receipt=nullptr):receipt_(receipt) {
    pipe_.reset(CreateNamedPipeW(name.c_str(),PIPE_ACCESS_DUPLEX|FILE_FLAG_OVERLAPPED|FILE_FLAG_FIRST_PIPE_INSTANCE,PIPE_TYPE_BYTE|PIPE_READMODE_BYTE|PIPE_WAIT,1,65536,65536,0,nullptr));
    if(!pipe_.valid())throw WinError("owned control pipe");noninherit(pipe_.get());
    event_.reset(CreateEventW(nullptr,TRUE,FALSE,nullptr));if(!event_.valid())throw WinError("owned connect event");noninherit(event_.get());
    operation_.hEvent=event_.get();
    if(ConnectNamedPipe(pipe_.get(),&operation_)){observed(ERROR_SUCCESS);return;}
    const auto error=GetLastError();
    if(error==ERROR_PIPE_CONNECTED){observed(ERROR_SUCCESS);return;}
    if(error!=ERROR_IO_PENDING)throw WinError("owned connect start",error);
    pending_=true;if(receipt_)receipt_->pending_started=true;
    // No potentially throwing work follows a successfully posted pending operation.
  }
  PendingConnect(const PendingConnect&)=delete;PendingConnect& operator=(const PendingConnect&)=delete;
  ~PendingConnect() noexcept {cancel_and_complete();}
  HANDLE get()const noexcept {return pipe_.get();}
  void wait(ULONGLONG deadline) {
    if(!pending_)return;
    const auto now=GetTickCount64();
    if(now>=deadline||WaitForSingleObject(event_.get(),static_cast<DWORD>(deadline-now))!=WAIT_OBJECT_0)throw ConnectTimeout();
    DWORD ignored=0;
    if(GetOverlappedResult(pipe_.get(),&operation_,&ignored,FALSE)){observed(ERROR_SUCCESS);return;}
    const auto error=GetLastError();
    if(terminal_error(error))observed(error);
    throw WinError("owned connect completion",error);
  }
  void cancel_and_complete() noexcept {
    if(!pending_)return;
    // CancelIoEx does not wait. Even ERROR_NOT_FOUND can mean completion won the race;
    // retain all storage and independently observe the operation's final result.
    (void)CancelIoEx(pipe_.get(),&operation_);
    if(WaitForSingleObject(event_.get(),2000)!=WAIT_OBJECT_0)ExitProcess(75);
    DWORD ignored=0;
    if(GetOverlappedResult(pipe_.get(),&operation_,&ignored,FALSE)){observed(ERROR_SUCCESS);return;}
    const auto error=GetLastError();
    if(!terminal_error(error))ExitProcess(75);
    observed(error);
  }
  void close() noexcept {cancel_and_complete();pipe_.reset();}
};
// Real Windows negatives, deliberately unconnected. These must run on Windows;
// no Linux facade, no source-text assertions, and no production fault switch.
static void pending_connect_failure_gates(const std::u16string& cwd,Stdio streams) {
  ConnectReceipt timeout_receipt;bool timeout_observed=false;
  try {
    PendingConnect unconnected(LR"(\\.\pipe\atlas-agent-job-)"+random_hex(32),&timeout_receipt);
    unconnected.wait(GetTickCount64()+20);
  }catch(const ConnectTimeout&){timeout_observed=true;}
  check(timeout_observed&&timeout_receipt.pending_started,"unconnected timeout owns pending request");
  check(timeout_receipt.completion_observed&&timeout_receipt.completion_error==ERROR_OPERATION_ABORTED,"timeout observes actual cancelled completion before unwind");
  ConnectReceipt failed_start_receipt;bool start_failed=false;
  try {
    PendingConnect waiting(LR"(\\.\pipe\atlas-agent-job-)"+random_hex(32),&failed_start_receipt);
    OwnedJob missing_helper;
    // A fresh, test-owned name cannot accidentally resolve an installed executable.
    missing_helper.create({cwd+u"\\atlas-missing-helper-"+u16(random_hex(32))+u".exe",cwd,{},{}},streams);
    throw std::runtime_error("missing helper unexpectedly created");
  }catch(const WinError&){start_failed=true;}
  check(start_failed&&failed_start_receipt.pending_started,"pre-connect helper creation fails with pending request");
  check(failed_start_receipt.completion_observed&&failed_start_receipt.completion_error==ERROR_OPERATION_ABORTED,"failed startup observes connect cancellation before unwind");
}
static void pipe_io(HANDLE pipe,void* bytes,DWORD size,bool writing,ULONGLONG deadline){
  Handle event(CreateEventW(nullptr,TRUE,FALSE,nullptr));check(event.valid(),"test I/O event");OVERLAPPED operation{};operation.hEvent=event.get();DWORD done=0;
  const auto immediate=writing?WriteFile(pipe,bytes,size,&done,&operation):ReadFile(pipe,bytes,size,&done,&operation);
  if(!immediate){check(GetLastError()==ERROR_IO_PENDING,"test I/O pending");const auto now=GetTickCount64();if(now>=deadline||WaitForSingleObject(event.get(),static_cast<DWORD>(deadline-now))!=WAIT_OBJECT_0){CancelIoEx(pipe,&operation);if(WaitForSingleObject(event.get(),2000)!=WAIT_OBJECT_0)ExitProcess(74);throw std::runtime_error("test I/O deadline");}check(GetOverlappedResult(pipe,&operation,&done,FALSE)!=FALSE,"test I/O result");}
  check(done==size,"test I/O length");
}
static Frame read_frame(HANDLE pipe,ULONGLONG deadline){
  std::vector<std::uint8_t> prefix(4);pipe_io(pipe,prefix.data(),4,false,deadline);auto length=read_u32(prefix,0);check(length>=1&&length+4<=kMaxFrame,"test frame budget");std::vector<std::uint8_t> body(length);pipe_io(pipe,body.data(),length,false,deadline);prefix.insert(prefix.end(),body.begin(),body.end());Decoder decoder;auto frames=decoder.feed(prefix);check(frames.size()==1,"one control frame");return frames.front();
}
static void control_gates(const std::u16string& helper,const std::u16string& fixture,const std::u16string& cwd,Stdio streams,HANDLE sentinel){
  for(const auto& scenario:{u"0",u"1",u"kill-helper",u"owner-EOF",u"STOP"}){
    const auto name=LR"(\\.\pipe\atlas-agent-job-)"+random_hex(32);const auto secret=random_hex(64);
    PendingConnect connection(name);
    HANDLE read=nullptr,write=nullptr;check(CreatePipe(&read,&write,nullptr,0)!=FALSE,"helper owned output");Handle output_read(read),output_write(write);noninherit(output_read.get());noninherit(output_write.get());
    OwnedJob helper_owner;helper_owner.create({helper,cwd,{u"--pipe",u16(name),u"--nonce",u16(secret)},{}},{streams.input,output_write.get(),output_write.get()});auto helper_observer=duplicate_observer(helper_owner.root());helper_owner.resume();output_write.reset();
    connection.wait(GetTickCount64()+5000);
    auto hello=read_frame(connection.get(),GetTickCount64()+5000);check(hello.type==Type::Hello&&read_u32(hello.payload,0)==1,"helper protocol HELLO");
    const auto digit=[](wchar_t c){return c<=L'9'?c-L'0':c-L'a'+10;};for(std::size_t i=0;i<32;++i)check(hello.payload[i+4]==static_cast<std::uint8_t>((digit(secret[i*2])<<4)|digit(secret[i*2+1])),"helper nonce authentication");
    const bool exiting=std::u16string(scenario)==u"0"||std::u16string(scenario)==u"1";
    auto launch=encode_frame(Type::Launch,encode_launch({fixture,cwd,{exiting?u"tree-exit":u"tree-hold",u16(std::to_wstring(GetCurrentProcessId())),exiting?std::u16string(scenario):u"0"},{}}));pipe_io(connection.get(),launch.data(),static_cast<DWORD>(launch.size()),true,GetTickCount64()+2000);
    auto ready=read_frame(connection.get(),GetTickCount64()+5000);check(ready.type==Type::Ready,"real helper READY");
    const auto line=read_line(output_read.get(),GetTickCount64()+3000);check(line.rfind("DESC ",0)==0,"helper descendant receipt");Handle descendant(reinterpret_cast<HANDLE>(static_cast<std::uintptr_t>(std::stoull(line.substr(5)))));noninherit(descendant.get());
    if(std::u16string(scenario)==u"kill-helper"){
      check(TerminateProcess(helper_owner.root(),99)!=FALSE,"real owned helper termination");
      check(WaitForSingleObject(helper_observer.get(),3000)==WAIT_OBJECT_0,"helper fault exit");
    }else if(std::u16string(scenario)==u"owner-EOF"){
      connection.close();check(WaitForSingleObject(helper_observer.get(),5000)==WAIT_OBJECT_0,"owner EOF bounded helper exit");
    }else{
      if(std::u16string(scenario)==u"STOP"){auto stop=encode_frame(Type::Stop,{});auto repeated=stop;repeated.insert(repeated.end(),stop.begin(),stop.end());pipe_io(connection.get(),repeated.data(),static_cast<DWORD>(repeated.size()),true,GetTickCount64()+2000);}
      bool root_exit=false,empty=false;const auto deadline=GetTickCount64()+5000;
      while(!empty){auto status=read_frame(connection.get(),deadline);if(status.type==Type::RootExit){root_exit=true;if(exiting)check(read_u32(status.payload,0)==static_cast<std::uint32_t>(scenario[0]-u'0'),"actual root-first code");}else if(status.type==Type::JobEmpty)empty=true;else throw std::runtime_error("unexpected control status");}
      check(root_exit,"root HANDLE separate from stdio");check(WaitForSingleObject(helper_observer.get(),3000)==WAIT_OBJECT_0,"helper acknowledged exit");
    }
    check(WaitForSingleObject(descendant.get(),3000)==WAIT_OBJECT_0,"real helper owned descendant signaled");
    check(WaitForSingleObject(sentinel,0)==WAIT_TIMEOUT,"real helper excludes unrelated owned sentinel");
    check(helper_owner.stop(GetTickCount64()+2000),"outer helper owner Job empty");
  }
}
int wmain(int argc,wchar_t** argv) {
  if(argc!=3){std::cerr<<"usage: job-harness.exe absolute-job-fixture.exe absolute-atlas-agent-job.exe\n";return 2;}
  try {
    const auto exe=u16(argv[1]); auto cwd=u16(std::filesystem::current_path().wstring());
    Handle nullin(CreateFileW(L"NUL",GENERIC_READ,FILE_SHARE_READ|FILE_SHARE_WRITE,nullptr,OPEN_EXISTING,0,nullptr));
    Handle nullout(CreateFileW(L"NUL",GENERIC_WRITE,FILE_SHARE_READ|FILE_SHARE_WRITE,nullptr,OPEN_EXISTING,0,nullptr));
    check(nullin.valid()&&nullout.valid(),"owned stdio handles");
    // Suspended root observer is obtained before any payload instruction can run.
    OwnedJob job; job.create({exe,cwd,{u"hold"},{}},{nullin.get(),nullout.get(),nullout.get()});
    BOOL assigned=FALSE;check(IsProcessInJob(job.root(),job.job(),&assigned)&&assigned,"atomic assignment before resume");
    auto observer=duplicate_observer(job.root());
    check(WaitForSingleObject(observer.get(),0)==WAIT_TIMEOUT,"suspended root not signaled");
    job.resume();check(job.stop(GetTickCount64()+2000),"job empty accounting");
    check(WaitForSingleObject(observer.get(),2000)==WAIT_OBJECT_0,"owned root signaled");
    // Kill-on-last-close covers a root that never resumed, without any Assign fallback.
    Handle suspended_observer;
    { OwnedJob suspended;suspended.create({exe,cwd,{u"hold"},{}},{nullin.get(),nullout.get(),nullout.get()});suspended_observer=duplicate_observer(suspended.root()); }
    check(WaitForSingleObject(suspended_observer.get(),2000)==WAIT_OBJECT_0,"kill-on-close suspended root");
    // A sentinel belongs to a separate owned Job and must remain alive after victim cleanup.
    OwnedJob sentinel;sentinel.create({exe,cwd,{u"hold"},{}},{nullin.get(),nullout.get(),nullout.get()});sentinel.resume();
    auto sentinel_observer=duplicate_observer(sentinel.root());
    for(const auto& code:{u"0",u"1"}) {
      OwnedJob early;early.create({exe,cwd,{u"exit",code},{}},{nullin.get(),nullout.get(),nullout.get()});auto early_observer=duplicate_observer(early.root());early.resume();
      check(WaitForSingleObject(early_observer.get(),2000)==WAIT_OBJECT_0,"root first exit");
      DWORD actual=99;check(GetExitCodeProcess(early.root(),&actual)&&actual==static_cast<DWORD>(code[0]-u'0'),"root exit code");
      check(early.stop(GetTickCount64()+2000),"root-first independent job lifetime");
      check(WaitForSingleObject(sentinel_observer.get(),0)==WAIT_TIMEOUT,"outside sentinel remains alive");
    }
    // A descendant is observed before its ResumeThread and retains both streams
    // after root exit. Inner Job kill-close is off, so only the outer Job can settle it.
    for(const auto& code:{u"0",u"1"}) {
      HANDLE read=nullptr,write=nullptr;check(CreatePipe(&read,&write,nullptr,0)!=FALSE,"owned stream pipe");Handle output_read(read),output_write(write);noninherit(output_read.get());noninherit(output_write.get());
      const auto harness_id=std::to_wstring(GetCurrentProcessId());
      OwnedJob tree;tree.create({exe,cwd,{u"tree-exit",u16(harness_id),code},{}},{nullin.get(),output_write.get(),output_write.get()});auto root_observer=duplicate_observer(tree.root());tree.resume();output_write.reset();
      const auto line=read_line(output_read.get(),GetTickCount64()+3000);check(line.rfind("DESC ",0)==0,"descendant handle receipt");
      Handle descendant(reinterpret_cast<HANDLE>(static_cast<std::uintptr_t>(std::stoull(line.substr(5)))));noninherit(descendant.get());
      check(WaitForSingleObject(root_observer.get(),3000)==WAIT_OBJECT_0,"root exited before descendant");
      check(WaitForSingleObject(descendant.get(),0)==WAIT_TIMEOUT,"descendant outlives root");
      check(tree.stop(GetTickCount64()+2000),"root-first tree empty");check(WaitForSingleObject(descendant.get(),2000)==WAIT_OBJECT_0,"owned descendant signaled");
      DWORD available=0;check(!PeekNamedPipe(output_read.get(),nullptr,0,nullptr,&available,nullptr)&&GetLastError()==ERROR_BROKEN_PIPE,"held stdio EOF after tree cleanup");
      check(WaitForSingleObject(sentinel_observer.get(),0)==WAIT_TIMEOUT,"tree cleanup excludes sentinel");
    }
    // exe-only refusal leaves no resumed process.
    bool refused=false;try{OwnedJob invalid;invalid.create({u"C:\\unknown.cmd",cwd,{},{}},{nullin.get(),nullout.get(),nullout.get()});}catch(const std::exception&){refused=true;}
    check(refused,"cmd shim refusal");
    pending_connect_failure_gates(cwd,{nullin.get(),nullout.get(),nullout.get()});
    control_gates(u16(argv[2]),exe,cwd,{nullin.get(),nullout.get(),nullout.get()},sentinel_observer.get());
    check(sentinel.stop(GetTickCount64()+2000),"owned sentinel final cleanup");
    std::cout<<"PASS Windows atomic assignment/root-first/last-close/sentinel owned HANDLE gates\n";
    return 0;
  }catch(const std::exception& error){std::cerr<<error.what()<<'\n';return 1;}
}
