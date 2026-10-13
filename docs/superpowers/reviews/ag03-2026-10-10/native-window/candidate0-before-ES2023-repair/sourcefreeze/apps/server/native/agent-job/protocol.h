#pragma once
#include <cstdint>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>
namespace atlas::job {
inline constexpr std::uint32_t kProtocol = 1;
inline constexpr std::size_t kMaxFrame = 1024 * 1024;
inline constexpr std::size_t kMaxStatusFrame = 256;
enum class Type : std::uint8_t { Hello=1, Launch=2, Ready=3, RootExit=4, Stop=5, JobEmpty=6, Error=7 };
struct ProtocolError : std::runtime_error { using std::runtime_error::runtime_error; };
struct Frame { Type type; std::vector<std::uint8_t> payload; };
struct Launch { std::u16string command, cwd; std::vector<std::u16string> args; std::vector<std::pair<std::u16string,std::u16string>> env; };
std::u16string strict_utf8(const std::string& value);
std::u16string quote_argument(const std::u16string& value);
std::u16string command_line(const Launch& launch);
std::vector<std::uint8_t> encode_launch(const Launch& launch);
Launch parse_launch(const std::vector<std::uint8_t>& payload);
std::vector<std::uint8_t> encode_frame(Type type, const std::vector<std::uint8_t>& payload);
void append_u32(std::vector<std::uint8_t>& bytes, std::uint32_t value);
std::uint32_t read_u32(const std::vector<std::uint8_t>& bytes, std::size_t position);
class Decoder { std::vector<std::uint8_t> pending_; public: std::vector<Frame> feed(const std::vector<std::uint8_t>& bytes); };
}
