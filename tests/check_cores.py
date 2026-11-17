# Garante que as cores de significado não dependem do tema (ex.: "adaptado" sempre amarelo).
# Uso: python3 tests/check_cores.py  (sai com erro se achar problema)
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
css = (root / 'style.css').read_text(encoding='utf-8')
app = (root / 'app.js').read_text(encoding='utf-8')
erros = []
for sel in ('.fslot.ok', '.fslot.near', '.fslot.bad', '.legend i.lg-'):
    for m in re.finditer(re.escape(sel) + r'[^{]*\{([^}]*)\}', css):
        if '--gold' in m.group(1): erros.append(f'{sel} usa --gold: {m.group(0)[:80]}')
for m in re.finditer(r'(adaptado|na posição|fora de posição)', app):
    trecho = app[max(0, m.start() - 80):m.start()]
    if 'var(--gold)' in trecho: erros.append('legenda de posição usando --gold perto de: ' + m.group(0))
# os temas de modo não podem redefinir as cores de significado
for m in re.finditer(r'body\[data-mode=[^\]]+\][^{]*\{([^}]*)\}', css):
    if re.search(r'--(ok|warn|bad)\s*:', m.group(1)): erros.append('tema de modo redefine cor de significado: ' + m.group(0)[:80])
if erros:
    print('\n'.join(erros)); sys.exit(1)
print('ok: cores de significado independentes do tema')
