#pragma once
#ifndef _WIN32
#error The owned Job implementation requires real Windows; no portable fallback exists.
#endif
#include <Windows.h>
#include "protocol.h"
namespace atlas::job {
class Handle {
  HANDLE value_=nullptr;
public:
  Handle()=default; explicit Handle(HANDLE value):value_(value){}
  ~Handle(){reset();} Handle(const Handle&)=delete;Handle& operator=(const Handle&)=delete;
  Handle(Handle&& other) noexcept:value_(other.release()){}
  Handle& operator=(Handle&& other) noexcept {if(this!=&other)reset(other.release());return *this;}
  bool valid()const{return value_!=nullptr&&value_!=INVALID_HANDLE_VALUE;}
  HANDLE get()const{return value_;} HANDLE release(){auto old=value_;value_=nullptr;return old;}
  void reset(HANDLE value=nullptr){if(valid())CloseHandle(value_);value_=value;}
};
struct WinError:std::runtime_error { DWORD code;explicit WinError(const char* operation,DWORD error=GetLastError()):std::runtime_error(operation),code(error){} };
struct Stdio { HANDLE input, output, error; };
class OwnedJob {
  Handle job_,root_,thread_; bool resumed_=false; bool stopping_=false;
public:
  OwnedJob(); ~OwnedJob()=default;OwnedJob(const OwnedJob&)=delete;OwnedJob& operator=(const OwnedJob&)=delete;
  void create(const Launch& launch,Stdio streams);
  void resume();
  bool stop(ULONGLONG deadline);
  bool empty()const;
  HANDLE root()const{return root_.get();}
  HANDLE job()const{return job_.get();}
  DWORD root_id()const{return GetProcessId(root_.get());}
};
std::wstring wide(const std::u16string& s);
void noninherit(HANDLE handle);
}
