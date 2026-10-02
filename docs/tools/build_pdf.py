# Deploy.md/qualquer .md → PDF: markdown→HTML (+capa) → Chrome headless (print_pdf.mjs) → pypdf junta.
# Uso: python3 build_pdf.py <arquivo.md> <saida.pdf> "<Título>" "<Subtítulo>"
import sys, subprocess, datetime, html, re, pathlib, markdown
from pypdf import PdfWriter, PdfReader
md_path, out_pdf, title, subtitle = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
here = pathlib.Path(__file__).parent
src = pathlib.Path(md_path).read_text(encoding='utf-8')
src = re.sub(r'^# .*\n', '', src, count=1)  # o título vai na capa
body = markdown.markdown(src, extensions=['tables', 'fenced_code', 'toc', 'sane_lists'])
css = """
@page { size: A4; margin: 18mm 16mm 20mm 16mm; }
* { box-sizing: border-box; }
body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 10.2pt; line-height: 1.55; color: #1f2937; }
h2 { font-size: 16pt; color: #0f172a; border-bottom: 2px solid #3858e9; padding-bottom: 4px; margin: 26px 0 10px; page-break-after: avoid; }
h3 { font-size: 12.5pt; color: #0f172a; margin: 18px 0 6px; page-break-after: avoid; }
h4 { font-size: 11pt; margin: 14px 0 4px; }
p, li { orphans: 3; widows: 3; }
a { color: #3858e9; text-decoration: none; }
code { font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 8.8pt; background: #f1f5f9; padding: 1px 4px; border-radius: 3px; }
pre { background: #0f172a; color: #e2e8f0; padding: 10px 12px; border-radius: 6px; white-space: pre-wrap; word-break: break-word; page-break-inside: avoid; }
pre code { background: none; color: inherit; padding: 0; font-size: 8.4pt; }
table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 8.8pt; page-break-inside: auto; }
th, td { border: 1px solid #cbd5e1; padding: 5px 7px; vertical-align: top; text-align: left; }
th { background: #eef2ff; }
td:first-child { width: 28%; } td:nth-child(2) { width: 24%; }
tr { page-break-inside: avoid; }
blockquote { margin: 10px 0; padding: 8px 12px; background: #fff7ed; border-left: 4px solid #f59e0b; border-radius: 4px; }
hr { border: 0; border-top: 1px solid #e2e8f0; margin: 18px 0; }
"""
(here / 'main.html').write_text(f'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>{css}</style></head><body>{body}</body></html>', encoding='utf-8')
today = datetime.date.today().strftime('%d/%m/%Y')
cover = f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
@page {{ size: A4; margin: 0; }} body {{ margin: 0; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; }}
.c {{ height: 297mm; background: linear-gradient(160deg, #0b1120 0%, #151d30 60%, #1e2a4a 100%); color: #fff; display: flex; flex-direction: column; justify-content: center; padding: 0 22mm; }}
.m {{ width: 64px; height: 64px; border-radius: 16px; background: #3858e9; display: grid; place-items: center; font-weight: 800; font-size: 24px; margin-bottom: 28px; }}
.b {{ font-size: 15pt; letter-spacing: .5px; opacity: .85; margin-bottom: 8px; }} .b span {{ color: #7c93ff; }}
h1 {{ font-size: 34pt; margin: 0 0 10px; line-height: 1.1; }} .s {{ font-size: 14pt; opacity: .8; }} .d {{ margin-top: 40px; font-size: 10.5pt; opacity: .6; }}
</style></head><body><div class="c"><div class="m">PM</div><div class="b">Pub <span>Mail</span></div><h1>{html.escape(title)}</h1><div class="s">{html.escape(subtitle)}</div><div class="d">Atualizado em {today}</div></div></body></html>"""
(here / 'cover.html').write_text(cover, encoding='utf-8')
subprocess.run(['node', str(here / 'print_pdf.mjs'), str(here / 'cover.html'), str(here / 'cover.pdf'), ''], check=True)
subprocess.run(['node', str(here / 'print_pdf.mjs'), str(here / 'main.html'), str(here / 'main.pdf'), f'Pub Mail · {title}'], check=True)
w = PdfWriter()
for f in ('cover.pdf', 'main.pdf'):
    for p in PdfReader(str(here / f)).pages:
        w.add_page(p)
with open(out_pdf, 'wb') as fh:
    w.write(fh)
print('ok', out_pdf, len(w.pages), 'páginas')
