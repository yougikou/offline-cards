const fs = require('fs');
const path = 'src/components/DraggableCard.tsx';
let code = fs.readFileSync(path, 'utf8');

// Update selectAnim interpolate range from [0, -8] to [0, -15]
code = code.replace(/\{ translateY: selectAnim.interpolate\(\{ inputRange: \[0, 1\], outputRange: \[0, -8\] \}\) \}/g, '{ translateY: selectAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -15] }) }');

// Update borderStyle color from #444 to #FFD700
code = code.replace(/const borderStyle = isSelected \? \{ borderColor: '#444', borderWidth: 2 \} : \{ borderColor: '#E0E0E0', borderWidth: 1 \};/g, "const borderStyle = isSelected ? { borderColor: '#FFD700', borderWidth: 2 } : { borderColor: '#E0E0E0', borderWidth: 1 };");

fs.writeFileSync(path, code);
