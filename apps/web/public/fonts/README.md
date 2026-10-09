# AtlasMode 本地 Nerd 图标

`atlasmode-nerd-icons.woff2` 随 web 静态资源分发，体积 1,144 字节。
`NodeIdentity` 自动导入 `nodeIdentity.css`；成功加载该字体后显示 Nerd 字形，
加载期间与字体不可用时显示通用 `◇`。类型文字始终可见，屏幕阅读器读取名称与类型。

## 固定来源与许可

- 来源：Nerd Fonts **v3.4.0**，commit
  [`fa7b859994228a9c8759f99c55a8d31ee92a1b5e`](https://github.com/ryanoasis/nerd-fonts/tree/fa7b859994228a9c8759f99c55a8d31ee92a1b5e)。
- 原始字体：[SymbolsNerdFont-Regular.ttf](https://github.com/ryanoasis/nerd-fonts/blob/fa7b859994228a9c8759f99c55a8d31ee92a1b5e/patched-fonts/NerdFontsSymbolsOnly/SymbolsNerdFont-Regular.ttf)。
- 本子集保留 Font Awesome 的六个字形，字体形态适用 SIL OFL 1.1。
  Fonticons, Inc. 的完整授权与版权信息保存在 [LICENSE-FontAwesome.txt](LICENSE-FontAwesome.txt)。
- Symbols Only 的 MIT 授权保存在 [LICENSE-NerdFontsSymbols.txt](LICENSE-NerdFontsSymbols.txt)；
  上游总授权保存在 [LICENSE-NerdFonts.md](LICENSE-NerdFonts.md)。
- 子集字体家族名为 `AtlasMode Nerd Icons`，PostScript 名为
  `AtlasModeNerdIcons-Regular`。保留原字体的许可元数据，Font Awesome 保留字体名称用于原版。

| 用途              | 字符   | Nerd Fonts 字形  |
| ----------------- | ------ | ---------------- |
| 函数 / 旧快照声明 | U+F121 | fa-code          |
| 方法              | U+F0E8 | fa-sitemap       |
| 类                | U+F1B2 | fa-cube          |
| 目录              | U+F07B | fa-folder        |
| 文件              | U+F15B | fa-file          |
| 外部依赖          | U+F08E | fa-external_link |

原始 TTF SHA-256：`71db104aa66567d0efe0b98758f9dfc1895573a453fe85fb53d1c38544a55106`。

本子集 SHA-256：`b3a56a57137452092ae9d604f63b08854453f4a177af9c1a6ff7865d7d45315b`。

## 复现子集

构建工具为 Python fonttools 4.66.1 和 brotli 1.2.0；产品运行时使用现成 WOFF2。
取得上述固定来源的 TTF，并以 `SymbolsNerdFont-Regular.ttf` 保存后执行：

```bash
pyftsubset SymbolsNerdFont-Regular.ttf \
  --unicodes=U+F07B,U+F08E,U+F0E8,U+F121,U+F15B,U+F1B2 \
  --flavor=woff2 --name-IDs='*' --name-legacy --name-languages='*' \
  --glyph-names --output-file=atlasmode-nerd-icons.woff2
python - <<'PY'
from fontTools.ttLib import TTFont
path = 'atlasmode-nerd-icons.woff2'
font = TTFont(path, recalcTimestamp=False)
names = {
    1: 'AtlasMode Nerd Icons', 2: 'Regular',
    3: 'AtlasMode-Nerd-Icons-3.4.0', 4: 'AtlasMode Nerd Icons Regular',
    6: 'AtlasModeNerdIcons-Regular', 16: 'AtlasMode Nerd Icons', 17: 'Regular',
}
for record in font['name'].names:
    if record.nameID in names:
        record.string = names[record.nameID].encode(record.getEncoding())
font.save(path)
PY
```

fonttools 对上游 FontForge 的 `PfEd` 表报告丢弃提示；该表保存编辑器附加信息。
输出保留六个字符映射、字形轮廓及 `.notdef`，用于网页显示。
