// Pure owned fixture. The only PID input is the harness that created this fixture.
#include "../job.h"
#include <array>
#include <cwchar>
#include <iostream>
using namespace atlas::job;
static std::wstring executable(){std::array<wchar_t,32768> path{};auto n=GetModuleFileNameW(nullptr,path.data(),static_cast<DWORD>(path.size()));if(!n||n>=path.size())throw WinError("fixture path");return {path.data(),n};}
static std::u16string u16(const std::wstring& s){return{reinterpret_cast<const char16_t*>(s.data()),s.size()};}
int wmain(int argc,wchar_t** argv){
  try{
    if(argc==2&&std::wcscmp(argv[1],L"hold")==0){Sleep(INFINITE);return 90;}
    if(argc==3&&std::wcscmp(argv[1],L"exit")==0)return std::wcscmp(argv[2],L"0")==0?0:1;
    if(argc==4&&(std::wcscmp(argv[1],L"tree-exit")==0||std::wcscmp(argv[1],L"tree-hold")==0)){
      const auto harness_id=static_cast<DWORD>(std::wcstoul(argv[2],nullptr,10));
      Handle harness(OpenProcess(PROCESS_DUP_HANDLE,FALSE,harness_id));if(!harness.valid())throw WinError("owned harness observer");noninherit(harness.get());
      // This inner Job is nested in the helper's private Job. It keeps stdout/stderr
      // alive until the harness releases its root-first barrier and the outer Job stops.
      std::array<wchar_t,32768> directory{};auto count=GetCurrentDirectoryW(static_cast<DWORD>(directory.size()),directory.data());if(!count||count>=directory.size())throw WinError("fixture cwd");
      OwnedJob nested;nested.create({u16(executable()),u16(directory.data()),{u"hold"},{}},{GetStdHandle(STD_INPUT_HANDLE),GetStdHandle(STD_OUTPUT_HANDLE),GetStdHandle(STD_ERROR_HANDLE)});
      HANDLE observer=nullptr;if(!DuplicateHandle(GetCurrentProcess(),nested.root(),harness.get(),&observer,SYNCHRONIZE|PROCESS_QUERY_LIMITED_INFORMATION,FALSE,0))throw WinError("owned descendant observation");
      std::cout<<"DESC "<<reinterpret_cast<std::uintptr_t>(observer)<<'\n'<<std::flush;
      nested.resume();
      // Root exits without closing its Job in user code. Kernel closes this inner
      // Job, which would itself kill the descendant: clear only the inner kill-close
      // flag so the test genuinely depends on the OUTER helper Job to kill it.
      JOBOBJECT_EXTENDED_LIMIT_INFORMATION no_kill{};if(!SetInformationJobObject(nested.job(),JobObjectExtendedLimitInformation,&no_kill,sizeof(no_kill)))throw WinError("fixture inner job limits");
      if(std::wcscmp(argv[1],L"tree-hold")==0)Sleep(INFINITE);
      ExitProcess(std::wcscmp(argv[3],L"0")==0?0:1);
    }
    if(argc==2&&std::wcscmp(argv[1],L"argv")==0)return 2;
    if(argc>=2&&std::wcscmp(argv[1],L"echo")==0){
      for(int i=2;i<argc;++i){std::wstring argument=argv[i];std::cout<<argument.size()<<":";for(auto c:argument)std::cout<<static_cast<unsigned int>(c)<<",";std::cout<<"\n";}return 0;
    }
    return 2;
  }catch(const std::exception&){return 3;}
}
