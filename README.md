# belong. · Cape Town Edition

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
| `/` | "Travel to South Africa", painel ao vivo, cartão de embarque, mapa interativo (rota, "Ao redor", favoritos) e atalho de documentos |
| `/explore` | **Explore**: busca em linguagem natural de eventos, lugares e programas recorrentes em Cape Town (ver abaixo). `/mapa` redireciona para cá |
| `/essenciais` | Relógios, conversor de moedas, clima, emergência e internet |
| `/documentos` | Pastas por documento (passaporte, vacinas, aulas, moradia, seguro, outros) com anexos e checklist · números de emergência · backup |

## Estrutura

```
capetown_editorial/
├── backend/app/
│   ├── main.py              ← rotas da API
│   ├── db.py                ← SQLite (estado + anexos com categoria)
│   ├── budget.py            ← cálculo do orçamento (ainda não usado nas páginas novas)
│   ├── explore/             ← módulo do Explore (ver abaixo)
│   ├── explore_main.py      ← API só do Explore (a que vai para o Render)
│   ├── data/guide.json      ← TODO o conteúdo (edite aqui)
│   └── data/experiences.json← experiências verificadas do Belong
├── frontend/
│   ├── public/images/       ← coloque hero.jpg aqui para usar sua foto na home
│   └── src/
│       ├── pages/           ← Home, Explore, Documents, Essentials
│       ├── components/      ← BoardingPass, RegionMap, ExperienceCard, Icon, Chrome, ui
│       ├── api.explore.js   ← cliente da API do Explore
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

## Explore

Busca de experiências reais em Cape Town. A IA/parser só **entende** o pedido; os resultados vêm
sempre de fontes reais. Nada é inventado: campo sem dado vem `null` e o card mostra
"Preço não informado", "Consultar agenda" etc. Lugares (Google Places) nunca aparecem como evento.

### Fluxo

```
Explore.jsx → api.explore.js → POST /api/explore/search
  → parser (texto → intenção: atividade, categoria, bairro, data, preço, ao ar livre)
  → provedores em paralelo (Belong verificados · Google Places · Ticketmaster)
  → normalização (modelo Experience) → validação → deduplicação → filtros → ranking → paginação
  → JSON → cards
```

### Arquivos (`backend/app/explore/`)

| Arquivo | Papel |
|---|---|
| `config.py` | Lê variáveis de ambiente (`backend/.env` localmente) |
| `schemas.py` | `Experience`, `Filters`, `SearchRequest`, `SearchResponse`… |
| `categories.py` | 5 categorias, atividades, bairros e vocabulário |
| `parser.py` | Parser determinístico + interface opcional `IntentEnhancer` (LLM) |
| `providers/` | `belong_local.py`, `google_places.py`, `ticketmaster.py` (um arquivo por fonte) |
| `normalize.py`, `dedupe.py`, `ranking.py` | Limpeza, deduplicação e pontuação |
| `service.py` | Orquestra o pipeline e os erros de cada fonte |
| `router.py` | Endpoints |
| `store.py` | Favoritos (SQLite) e cache curto de detalhes |

### Endpoints

| Método | Rota | |
|---|---|---|
| GET | `/api/explore/health` | Status de cada fonte (ligada/sem chave) |
| GET | `/api/explore/categories` | Categorias |
| POST | `/api/explore/search` | `{ "q": "...", "filters": {...}, "lat", "lon", "page", "page_size" }` |
| GET | `/api/explore/experiences/{id}` | Detalhe |
| GET/POST/DELETE | `/api/explore/favorites` | Favoritos por aparelho (cabeçalho `X-Device-Id`) |
| GET | `/api/explore/photo?ref=` | Foto do Google pelo backend (a chave não vai para o navegador) |

Docs interativas: http://localhost:8000/docs

### Fontes

| Fonte | Precisa | Traz |
|---|---|---|
| Belong (verificados) | nada | `backend/app/data/experiences.json` — só entra item com `source.url`; `checked_at` marca "verificado em" |
| Google Places | `GOOGLE_PLACES_API_KEY` (Places API **New** ativada) | Lugares (tipo `place`), preço `$`–`$$$$` |
| Ticketmaster | `TICKETMASTER_API_KEY` (Discovery API) | Eventos com data; cobertura na África do Sul pode ser pequena |

Para conferir quais fontes funcionam: `cd backend && .venv/bin/python -m scripts.explore_sources`
(ou `--api https://SEU-SERVICO.onrender.com` para testar o servidor publicado).

Para adicionar uma experiência verificada, edite `experiences.json` com o link oficial em `source.url` e a data em `checked_at`.

### Rodar e testar localmente

```bash
cd backend
cp .env.example .env            # cole as chaves aqui, no seu computador
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m pytest -q   # testes (sem internet: as APIs são simuladas)
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```
e `npm run dev` no `frontend`. Sem chaves, o Explore funciona só com a fonte Belong.

### Deploy (Render + GitHub Pages)

1. Render → **New → Blueprint** → este repositório (usa `render.yaml`; sobe **só** `app.explore_main`, sem as rotas de documentos).
2. No serviço, **Environment**: cole `GOOGLE_PLACES_API_KEY` e `TICKETMASTER_API_KEY`. Nunca no código, no chat ou no frontend.
3. Copie a URL do serviço (ex.: `https://belong-explore-api.onrender.com`) e teste `/api/explore/health`.
4. GitHub → Settings → Secrets and variables → Actions → **Variables** → `EXPLORE_API_URL` = essa URL. Rode o workflow de novo (Actions → Run workflow).

Observações:
- Plano grátis do Render "dorme": a primeira busca pode levar ~1 min (o site mostra "Acordando o servidor…").
- O disco do Render é temporário: favoritos guardados no servidor somem a cada deploy. O site guarda os favoritos no navegador; para algo permanente, troque o SQLite por PostgreSQL.
- Google Places: o cache é curto (10 min) e as fotos não são armazenadas, conforme os termos do Google. Defina um limite de cota/orçamento no Google Cloud.
- No GitHub Pages, sem `EXPLORE_API_URL`, o Explore mostra o aviso "quase pronto" em vez de resultados.
