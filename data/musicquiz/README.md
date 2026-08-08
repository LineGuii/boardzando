# Music Quiz — dados

Este diretório é lido pelo servidor Nest no boot e observado via `fs.watch` para hot-reload.

## Estrutura

```
data/musicquiz/
├─ tracks.json           # perguntas (id, opções, correta, arquivo)
└─ assets/
   ├─ audio/<id>.mp3     # servido em /media/musicquiz/audio/<id>.mp3
   └─ covers/<id>.jpg    # opcional; /media/musicquiz/covers/<id>.jpg
```

## Adicionando uma pergunta

1. Copie o MP3 para `assets/audio/<id>.mp3` (ex: `assets/audio/bohemian.mp3`).
2. (Opcional) Copie a capa para `assets/covers/<id>.jpg`.
3. Edite `tracks.json` adicionando:
   ```json
   {
     "id": "bohemian",
     "title": "Bohemian Rhapsody",
     "artist": "Queen",
     "audioFile": "audio/bohemian.mp3",
     "coverFile": "covers/bohemian.jpg",
     "questionText": "Qual é essa música?",
     "options": ["Bohemian Rhapsody", "Stairway to Heaven", "Hotel California", "Imagine"],
     "correctIndex": 0,
     "startSec": 42,
     "durationSec": 20
   }
   ```
4. Salve. Log do servidor confirma o reload. A próxima partida usará a lista nova (partidas em curso mantêm o pool sorteado no início).

## Campos

- **id** *(str, obrigatório)* — único, usado só internamente.
- **audioFile** *(str, obrigatório)* — caminho relativo dentro de `assets/`.
- **questionText** *(str, obrigatório)* — enunciado exibido.
- **options** *(str[4], obrigatório)* — as 4 alternativas.
- **correctIndex** *(0..3, obrigatório)* — índice da correta em `options`.
- **title**, **artist**, **coverFile** — opcionais, aparecem no reveal.
- **startSec** *(default 0)* — segundo inicial do MP3.
- **durationSec** *(default 30)* — duração do trecho (só UI; timer real é sempre 30s).
