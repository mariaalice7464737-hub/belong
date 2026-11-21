# Cape Town · Editorial

Diário de viagem do intercâmbio em Cape Town. Backend em **Python (FastAPI + SQLite)** e frontend em **React (Vite)**, pensado primeiro para o celular.

## Versão online (GitHub Pages)

A cada push na `main`, o GitHub publica o site em **https://mariaalice7464737-hub.github.io/belong/**
(workflow em `.github/workflows/pages.yml`; ative em Settings → Pages → Source: GitHub Actions).

Essa versão roda sem o backend Python: o que você preenche e anexa fica salvo **no navegador**
de cada aparelho (localStorage + IndexedDB), não no servidor nem no GitHub. Para levar os dados
de um aparelho para outro, use **Exportar backup** e **Importar backup** em Documentos.

## Rodar

- **Windows:** extraia o zip e dê dois cliques em `start.bat`. Deixe as duas janelas pretas abertas; o navegador abre em http://localhost:5173
- **Mac/Linux:** `./start.sh`

Manual: veja a seção "Manual" no final.

## Páginas

| Rota | O que tem |
|---|---|
| `/` | Chamada "Travel to South Africa" (→ mapa), cartão de embarque (→ documentos) e índice de capítulos |
| `/mapa` | Mapa da África do Sul com as 9 províncias e o roteiro · um mapa único que abre na residência, com rota (partida/destino), botão "Ao redor" (supermercado, academia, farmácia…) e favoritos |
| `/documentos` | Pastas por documento (passaporte, vacinas, aulas, moradia, seguro, outros) com anexos e checklist · números de emergência · backup |

## Estrutura

```
capetown_editorial/
├── backend/app/
│   ├── main.py              ← rotas da API
│   ├── db.py                ← SQLite (estado + anexos com categoria)
│   ├── budget.py            ← cálculo do orçamento (ainda não usado nas páginas novas)
│   └── data/guide.json      ← TODO o conteúdo (edite aqui)
├── frontend/
│   ├── public/images/       ← coloque hero.jpg aqui para usar sua foto na home
│   ├── scripts/build-map.mjs← gera os contornos dos países
│   └── src/
│       ├── pages/           ← Home, MapPage, Documents
│       ├── components/      ← BoardingPass, AfricaMap, Icon, Chrome (barras), ui
│       ├── data/za-provinces.json  ← contornos das províncias (Natural Earth)
│       ├── data/southern-africa.json
│       └── styles.css       ← cores e fontes no topo (:root)
├── start.bat / start.sh
```

## O que editar no `guide.json`

| Chave | Para quê |
|---|---|
| `boarding_pass` | Origem/destino padrão e campos do voo |
| `doc_categories` | As pastas de documentos (id, nome, ícone, itens do checklist) |
| `documents` | Itens do checklist |
| `emergency` | Números importantes |
| `housing` | Endereço e informações da moradia |
| `nearby` | Categorias e lugares de "coisas perto" |
| `route_presets` | Atalhos de rotas (academia, hospital…) |
| `destinations` | Pontos do roteiro no mapa (`label`: top/bottom/left/right posiciona o nome) |
| `provinces` | Nome, capital, texto e posição do nome de cada província |

Ícones disponíveis: veja `frontend/src/components/Icon.jsx`.

## Google Maps

Os mapas usam o **embed público do Google Maps**, que **não precisa de chave de API**. Os botões "Abrir no Google Maps" abrem o app no celular com tempo e preço em tempo real.
Uma chave (Google Maps Platform) só seria necessária para mostrar distância/tempo dentro do próprio site ou listar lugares próximos automaticamente com nota e horário.

## Dados

Tudo o que você preenche e anexa fica em `backend/storage/` (banco `dossier.db` + `uploads/`). Use **Exportar backup** na página Documentos. Não suba `storage/` para o GitHub.

## Manual

```bash
# Terminal 1
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt      # Windows
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000

# Terminal 2
cd frontend
npm install
npm run dev
```
