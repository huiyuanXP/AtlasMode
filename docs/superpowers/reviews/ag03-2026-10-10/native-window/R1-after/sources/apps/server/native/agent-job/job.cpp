#include "job.h"
#include <algorithm>
#include <array>
#include <vector>
namespace atlas::job {
std::wstring wide(const std::u16string& s){static_assert(sizeof(wchar_t)==2);return {reinterpret_cast<const wchar_t*>(s.data()),s.size()};}
void noninherit(HANDLE h){if(!h||h==INVALID_HANDLE_VALUE||!SetHandleInformation(h,HANDLE_FLAG_INHERIT,0))throw WinError("private handle inheritance");}
namespace {
Handle std_duplicate(HANDLE h){
  // Std handles can alias each other; duplicate each into one exact HANDLE_LIST entry.
  if(!h||h==INVALID_HANDLE_VALUE||h==GetCurrentProcess()||h==GetCurrentThread())throw WinError("invalid std handle",ERROR_INVALID_HANDLE);
  HANDLE copy=nullptr;if(!DuplicateHandle(GetCurrentProcess(),h,GetCurrentProcess(),&copy,0,TRUE,DUPLICATE_SAME_ACCESS))throw WinError("duplicate std handle");return Handle(copy);
}
struct Attributes {
  std::vector<std::uint8_t> bytes;LPPROC_THREAD_ATTRIBUTE_LIST list=nullptr;
  Attributes(){SIZE_T size=0;InitializeProcThreadAttributeList(nullptr,2,0,&size);if(!size)throw WinError("attribute size");bytes.resize(size);list=reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(bytes.data());if(!InitializeProcThreadAttributeList(list,2,0,&size)){list=nullptr;throw WinError("attributes init");}}
  ~Attributes(){if(list)DeleteProcThreadAttributeList(list);}
};
void executable(const std::wstring& path){auto attributes=GetFileAttributesW(path.c_str());if(attributes==INVALID_FILE_ATTRIBUTES||(attributes&(FILE_ATTRIBUTE_DIRECTORY|FILE_ATTRIBUTE_REPARSE_POINT)))throw WinError("actual exe required",ERROR_BAD_EXE_FORMAT);}
}
OwnedJob::OwnedJob(){
#if !defined(_M_X64) && !defined(__x86_64__)
  throw WinError("Windows x64 only",ERROR_NOT_SUPPORTED);
#endif
  SYSTEM_INFO info{};GetNativeSystemInfo(&info);if(info.wProcessorArchitecture!=PROCESSOR_ARCHITECTURE_AMD64)throw WinError("Windows x64 only",ERROR_NOT_SUPPORTED);
  job_.reset(CreateJobObjectW(nullptr,nullptr));if(!job_.valid())throw WinError("create private job");noninherit(job_.get());
  JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};limits.BasicLimitInformation.LimitFlags=JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
  if(!SetInformationJobObject(job_.get(),JobObjectExtendedLimitInformation,&limits,sizeof(limits)))throw WinError("job limits");
}
void OwnedJob::create(const Launch& launch,Stdio streams){
  if(root_.valid()||stopping_)throw WinError("single launch",ERROR_INVALID_STATE);
  // The parser and the direct harness share all launch validation, including exe-only.
  (void)encode_launch(launch);auto command=wide(launch.command);executable(command);
  auto cwd=wide(launch.cwd);auto cwd_attributes=GetFileAttributesW(cwd.c_str());if(cwd_attributes==INVALID_FILE_ATTRIBUTES||!(cwd_attributes&FILE_ATTRIBUTE_DIRECTORY))throw WinError("actual cwd required",ERROR_DIRECTORY);
  auto args=wide(command_line(launch));std::vector<wchar_t> line(args.begin(),args.end());line.push_back(0);
  auto env=launch.env;std::sort(env.begin(),env.end(),[](const auto& a,const auto& b){return CompareStringOrdinal(reinterpret_cast<LPCWCH>(a.first.data()),static_cast<int>(a.first.size()),reinterpret_cast<LPCWCH>(b.first.data()),static_cast<int>(b.first.size()),TRUE)==CSTR_LESS_THAN;});
  std::vector<wchar_t> environment;for(const auto& [key,value]:env){auto pair=wide(key)+L"="+wide(value);environment.insert(environment.end(),pair.begin(),pair.end());environment.push_back(0);}if(environment.empty())environment.push_back(0);environment.push_back(0);
  auto input=std_duplicate(streams.input);auto output=std_duplicate(streams.output);auto error=std_duplicate(streams.error);
  std::array<HANDLE,3> handles{input.get(),output.get(),error.get()};Attributes attributes;HANDLE private_job=job_.get();
  if(!UpdateProcThreadAttribute(attributes.list,0,PROC_THREAD_ATTRIBUTE_HANDLE_LIST,handles.data(),sizeof(handles),nullptr,nullptr))throw WinError("handle list");
  // Creation itself assigns the private Job. There is no AssignProcessToJobObject fallback.
  if(!UpdateProcThreadAttribute(attributes.list,0,PROC_THREAD_ATTRIBUTE_JOB_LIST,&private_job,sizeof(private_job),nullptr,nullptr))throw WinError("atomic job list");
  STARTUPINFOEXW startup{};startup.StartupInfo.cb=sizeof(startup);startup.StartupInfo.dwFlags=STARTF_USESTDHANDLES;
  startup.StartupInfo.hStdInput=input.get();startup.StartupInfo.hStdOutput=output.get();startup.StartupInfo.hStdError=error.get();startup.lpAttributeList=attributes.list;
  PROCESS_INFORMATION process{};
  if(!CreateProcessW(command.c_str(),line.data(),nullptr,nullptr,TRUE,CREATE_SUSPENDED|EXTENDED_STARTUPINFO_PRESENT|CREATE_UNICODE_ENVIRONMENT|CREATE_NO_WINDOW,environment.data(),cwd.c_str(),&startup.StartupInfo,&process))throw WinError("owned CreateProcess");
  root_.reset(process.hProcess);thread_.reset(process.hThread);noninherit(root_.get());noninherit(thread_.get());BOOL assigned=FALSE;
  if(!IsProcessInJob(root_.get(),job_.get(),&assigned)||!assigned){TerminateJobObject(job_.get(),1);throw WinError("atomic job membership",ERROR_INVALID_STATE);}
  // RAII duplicates close now; caller owns original stdio and releases its own copies.
}
void OwnedJob::resume(){if(!root_.valid()||resumed_||stopping_)throw WinError("resume state",ERROR_INVALID_STATE);auto previous=ResumeThread(thread_.get());if(previous==static_cast<DWORD>(-1))throw WinError("resume");if(previous!=1)throw WinError("unexpected suspend count",ERROR_INVALID_STATE);resumed_=true;thread_.reset();}
bool OwnedJob::empty()const{JOBOBJECT_BASIC_ACCOUNTING_INFORMATION accounting{};if(!QueryInformationJobObject(job_.get(),JobObjectBasicAccountingInformation,&accounting,sizeof(accounting),nullptr))throw WinError("job accounting");return accounting.ActiveProcesses==0;}
bool OwnedJob::stop(ULONGLONG deadline){
  if(!stopping_){stopping_=true;if(!TerminateJobObject(job_.get(),1))throw WinError("terminate owned job");}
  for(;;){if(empty())return true;auto now=GetTickCount64();if(now>=deadline)return false;Sleep(static_cast<DWORD>(std::min<ULONGLONG>(20,deadline-now)));}
}
}
