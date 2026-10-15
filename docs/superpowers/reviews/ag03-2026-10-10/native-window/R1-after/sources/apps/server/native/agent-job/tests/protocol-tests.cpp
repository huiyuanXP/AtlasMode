#include "../protocol.h"
#include <cstdlib>
#include <iostream>
#include <stdexcept>
#include <iomanip>

using namespace atlas::job;
static void check(bool pass, const char* message) { if (!pass) throw std::runtime_error(message); }
template<class F> static void rejects(F operation) { bool rejected = false; try { operation(); } catch (const ProtocolError&) { rejected = true; } check(rejected, "expected rejection"); }
int main() {
  try {
    check(quote_argument(u"") == u"\"\"", "empty literal argument");
    check(quote_argument(u"a\"b") == u"\"a\\\"b\"", "quote literal argument");
    check(quote_argument(u"end\\") == u"\"end\\\\\"", "trailing slash");
    check(strict_utf8("\xe4\xb8\xad\xe6\x96\x87") == u"中文", "UTF8 round trip");
    rejects([] { strict_utf8(std::string("a\0b", 3)); });
    rejects([] { strict_utf8("\xc0\x80"); });
    rejects([] { strict_utf8("\xed\xa0\x80"); });
    rejects([] { strict_utf8("\xf4\x90\x80\x80"); });
    Decoder decoder;
    check(decoder.feed({1,0,0}).empty(), "split prefix");
    auto frames = decoder.feed({0,5,1,0,0,0,6});
    check(frames.size() == 2 && frames[0].type == Type::Stop && frames[1].type == Type::JobEmpty, "contiguous frames");
    rejects([] { Decoder d; d.feed({0,0,0,0}); });
    rejects([] { Decoder d; d.feed({255,255,255,127}); });
    rejects([] { Decoder d; d.feed({1,0,0,0,8}); });
    rejects([] { Decoder d; d.feed({2,0,0,0,5,1}); });
    rejects([] { Decoder d; d.feed({1,0,0,0,3}); });
    Launch launch{u"C:\\node.exe", u"C:\\work", {u"", u"中文", u"a\"b", u"end\\"}, {{u"Path",u"x"}}};
    auto payload = encode_launch(launch);
    auto parsed = parse_launch(payload);
    check(parsed.args == launch.args && parsed.env == launch.env, "literal launch values");
    payload.push_back(0); rejects([&] { parse_launch(payload); });
    launch.command = u"C:\\node.cmd"; rejects([&] { encode_launch(launch); });
    launch.command = u"node.exe"; rejects([&] { encode_launch(launch); });
    launch.command = u"C:\\node.exe"; launch.env.push_back({u"PATH",u"y"}); rejects([&] { encode_launch(launch); });
    launch.env.clear(); launch.args = {std::u16string(32767, u'x')}; rejects([&] { encode_launch(launch); });
    std::cout << "WIRE "; for(auto byte:encode_frame(Type::Launch,encode_launch(Launch{u"C:\\node.exe",u"C:\\work",{u"",u"中文",u"a\"b",u"end\\"},{{u"Path",u"x"}}})))std::cout << std::hex << std::setw(2) << std::setfill('0') << static_cast<unsigned int>(byte);std::cout << std::dec << '\n';
    std::cout << "PASS portable protocol: UTF8, literal argv, framing, launch budgets (not a Windows Job gate)\n";
    return 0;
  } catch (const std::exception& error) { std::cerr << error.what() << '\n'; return 1; }
}
