#include "protocol.h"
#include <algorithm>
#ifdef _WIN32
#include <Windows.h>
#endif
namespace atlas::job {
namespace {
void utf16(const std::u16string& value) {
  for (std::size_t i=0; i<value.size(); ++i) {
    auto c=value[i]; if (!c) throw ProtocolError("NUL text");
    if (c>=0xd800 && c<=0xdbff) { if (++i==value.size() || value[i]<0xdc00 || value[i]>0xdfff) throw ProtocolError("UTF16"); }
    else if (c>=0xdc00 && c<=0xdfff) throw ProtocolError("UTF16");
  }
}
std::string utf8(const std::u16string& value) {
  utf16(value); std::string out;
  for (std::size_t i=0;i<value.size();++i) {
    std::uint32_t c=value[i]; if (c>=0xd800 && c<=0xdbff) c=0x10000+((c-0xd800)<<10)+(value[++i]-0xdc00);
    if (c<0x80) out.push_back(static_cast<char>(c));
    else if (c<0x800) { out.push_back(static_cast<char>(0xc0|(c>>6))); out.push_back(static_cast<char>(0x80|(c&63))); }
    else if (c<0x10000) { out.push_back(static_cast<char>(0xe0|(c>>12))); out.push_back(static_cast<char>(0x80|((c>>6)&63))); out.push_back(static_cast<char>(0x80|(c&63))); }
    else { out.push_back(static_cast<char>(0xf0|(c>>18))); out.push_back(static_cast<char>(0x80|((c>>12)&63))); out.push_back(static_cast<char>(0x80|((c>>6)&63))); out.push_back(static_cast<char>(0x80|(c&63))); }
  } return out;
}
bool absolute(const std::u16string& s) {
  auto slash=[](char16_t c){return c==u'\\'||c==u'/';};
  if(s.size()>=3 && ((s[0]>=u'a'&&s[0]<=u'z')||(s[0]>=u'A'&&s[0]<=u'Z')) && s[1]==u':' && slash(s[2]))return true;
  if(s.size()<5 || s[0]!=u'\\' || s[1]!=u'\\')return false;
  auto server=s.find(u'\\',2); auto share=s.find(u'\\',server==std::u16string::npos?s.size():server+1);
  return server>2 && server!=std::u16string::npos && share>server+1 && share!=std::u16string::npos;
}
std::u16string upper_ascii(std::u16string s) { for(auto& c:s) if(c>=u'a'&&c<=u'z') c=static_cast<char16_t>(c-u'a'+u'A'); return s; }
bool equal_key(const std::u16string& a,const std::u16string& b) {
#ifdef _WIN32
  return CompareStringOrdinal(reinterpret_cast<LPCWCH>(a.data()),static_cast<int>(a.size()),reinterpret_cast<LPCWCH>(b.data()),static_cast<int>(b.size()),TRUE)==CSTR_EQUAL;
#else
  return upper_ascii(a)==upper_ascii(b); // Portable tests cover ASCII only; Windows is authoritative.
#endif
}
void validate(const Launch& launch) {
  utf16(launch.command); utf16(launch.cwd); auto exe=upper_ascii(launch.command);
  if(!absolute(exe)||exe.size()<4||exe.substr(exe.size()-4)!=u".EXE"||!absolute(launch.cwd))throw ProtocolError("absolute exe/cwd required");
  if(launch.args.size()>256||launch.env.size()>512)throw ProtocolError("launch count budget");
  for(const auto& arg:launch.args)utf16(arg);
  for(std::size_t i=0;i<launch.env.size();++i) {
    const auto& [key,value]=launch.env[i]; utf16(key);utf16(value);
    if(key.empty()||key.find(u'=')!=std::u16string::npos)throw ProtocolError("environment key");
    for(std::size_t j=0;j<i;++j)if(equal_key(key,launch.env[j].first))throw ProtocolError("duplicate environment key");
  }
  if(command_line(launch).size()+1>32767)throw ProtocolError("command line budget");
}
void append_text(std::vector<std::uint8_t>& bytes,const std::u16string& value) {
  auto encoded=utf8(value); if(encoded.size()>kMaxFrame)throw ProtocolError("text budget");
  append_u32(bytes,static_cast<std::uint32_t>(encoded.size()));bytes.insert(bytes.end(),encoded.begin(),encoded.end());
  if(bytes.size()+5>kMaxFrame)throw ProtocolError("frame budget");
}
void valid_frame(Type type,std::size_t size) {
  std::size_t expected=0;
  switch(type) { case Type::Hello:expected=36;break;case Type::Ready:case Type::RootExit:expected=4;break;case Type::Stop:case Type::JobEmpty:expected=0;break;case Type::Error:expected=8;break;case Type::Launch:if(size+5>kMaxFrame)throw ProtocolError("frame budget");return;default:throw ProtocolError("unknown type"); }
  if(size!=expected || size+5>kMaxStatusFrame)throw ProtocolError("status payload");
}
}
std::u16string strict_utf8(const std::string& value) {
  std::u16string out;
  for(std::size_t i=0;i<value.size();) {
    auto first=static_cast<std::uint8_t>(value[i++]);std::uint32_t c=0;std::size_t n=0;std::uint32_t minimum=0;
    if(first<128)c=first;
    else if(first>=0xc2&&first<=0xdf){c=first&31;n=1;minimum=0x80;}
    else if(first>=0xe0&&first<=0xef){c=first&15;n=2;minimum=0x800;}
    else if(first>=0xf0&&first<=0xf4){c=first&7;n=3;minimum=0x10000;}
    else throw ProtocolError("UTF8 prefix");
    if(n>value.size()-i)throw ProtocolError("UTF8 incomplete");
    for(std::size_t j=0;j<n;++j){auto b=static_cast<std::uint8_t>(value[i++]);if((b&0xc0)!=0x80)throw ProtocolError("UTF8 continuation");c=(c<<6)|(b&63);}
    if(!c||c<minimum||c>0x10ffff||(c>=0xd800&&c<=0xdfff))throw ProtocolError("UTF8 scalar");
    if(c<0x10000)out.push_back(static_cast<char16_t>(c));else {c-=0x10000;out.push_back(static_cast<char16_t>(0xd800+(c>>10)));out.push_back(static_cast<char16_t>(0xdc00+(c&1023)));}
  }return out;
}
std::u16string quote_argument(const std::u16string& value) {
  utf16(value);std::u16string out=u"\"";std::size_t slashes=0;
  for(auto c:value){if(c==u'\\'){++slashes;continue;}out.append(c==u'"'?slashes*2+1:slashes,u'\\');out.push_back(c);slashes=0;}
  out.append(slashes*2,u'\\');out.push_back(u'"');return out;
}
std::u16string command_line(const Launch& launch) { auto line=quote_argument(launch.command);for(const auto& arg:launch.args){line+=u' ';line+=quote_argument(arg);}return line; }
void append_u32(std::vector<std::uint8_t>& bytes,std::uint32_t n){for(unsigned int i=0;i<4;++i)bytes.push_back(static_cast<std::uint8_t>(n>>(i*8)));}
std::uint32_t read_u32(const std::vector<std::uint8_t>& bytes,std::size_t pos){if(pos>bytes.size()||bytes.size()-pos<4)throw ProtocolError("missing u32");std::uint32_t n=0;for(unsigned int i=0;i<4;++i)n|=static_cast<std::uint32_t>(bytes[pos+i])<<(i*8);return n;}
std::vector<std::uint8_t> encode_launch(const Launch& launch) {
  validate(launch);std::vector<std::uint8_t> out;append_text(out,launch.command);append_text(out,launch.cwd);append_u32(out,static_cast<std::uint32_t>(launch.args.size()));for(const auto& arg:launch.args)append_text(out,arg);append_u32(out,static_cast<std::uint32_t>(launch.env.size()));for(const auto& [key,value]:launch.env){append_text(out,key);append_text(out,value);}return out;
}
Launch parse_launch(const std::vector<std::uint8_t>& payload) {
  if(payload.size()+5>kMaxFrame)throw ProtocolError("frame budget");
  std::size_t pos=0;
  auto number=[&](){auto n=read_u32(payload,pos);pos+=4;return n;};
  auto string=[&](){auto n=number();if(n>payload.size()-pos)throw ProtocolError("text length");auto s=strict_utf8(std::string(payload.begin()+static_cast<std::ptrdiff_t>(pos),payload.begin()+static_cast<std::ptrdiff_t>(pos+n)));pos+=n;return s;};
  Launch out;out.command=string();out.cwd=string();auto args=number();if(args>256)throw ProtocolError("args budget");for(std::uint32_t i=0;i<args;++i)out.args.push_back(string());auto env=number();if(env>512)throw ProtocolError("env budget");for(std::uint32_t i=0;i<env;++i){auto key=string();auto value=string();out.env.emplace_back(key,value);}if(pos!=payload.size())throw ProtocolError("trailing bytes");validate(out);return out;
}
std::vector<std::uint8_t> encode_frame(Type type,const std::vector<std::uint8_t>& payload){valid_frame(type,payload.size());std::vector<std::uint8_t> out;append_u32(out,static_cast<std::uint32_t>(payload.size()+1));out.push_back(static_cast<std::uint8_t>(type));out.insert(out.end(),payload.begin(),payload.end());return out;}
std::vector<Frame> Decoder::feed(const std::vector<std::uint8_t>& bytes) {
  // Consume incrementally so a valid batch never creates an unbounded pending buffer.
  std::vector<Frame> out;std::size_t pos=0;
  while(pos<bytes.size()){
    auto want=pending_.size()<4?4:static_cast<std::size_t>(read_u32(pending_,0))+4;
    if(want<5 && pending_.size()>=4)throw ProtocolError("frame length");
    if(want>kMaxFrame)throw ProtocolError("frame budget");
    auto count=std::min(want-pending_.size(),bytes.size()-pos);pending_.insert(pending_.end(),bytes.begin()+static_cast<std::ptrdiff_t>(pos),bytes.begin()+static_cast<std::ptrdiff_t>(pos+count));pos+=count;
    if(pending_.size()<4)continue;
    auto length=read_u32(pending_,0);if(length<1||length+static_cast<std::uint64_t>(4)>kMaxFrame)throw ProtocolError("frame length");
    if(pending_.size()!=length+4)continue;
    auto type=static_cast<Type>(pending_[4]);valid_frame(type,length-1);out.push_back({type,{pending_.begin()+5,pending_.end()}});pending_.clear();
  }return out;
}
}
