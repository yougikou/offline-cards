const fs = require('fs');
let content = fs.readFileSync('AGENTS.md', 'utf-8');
if (!content.includes('zIndex')) {
    content += '\n6. 界面层级约束 (UI Z-Index Rule)：出牌或选中纸牌时，纸牌被遮挡，请确保选中的纸牌或拖拽中的纸牌肯定在最上层 (例如提高 zIndex)，避免被其他纸牌遮挡。';
    fs.writeFileSync('AGENTS.md', content);
}
