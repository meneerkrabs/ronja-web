# Ronja de Roversdochter in de browser

Een web-port van het avonturenspel *Ronja de Roversdochter* (O2Games / Malmberg, 2001), gebaseerd op het boek van Astrid Lindgren.

De originele `Game.exe` (C++/MFC, DirectDraw, Smacker, Miles Sound System) is gereverse-engineerd ([docs/re/](docs/re/)) en wordt hier in TypeScript nagebouwd: de 16-bits scène-opbouw met dieptetest en perspectief, padvinding, animatiesporen met lipsync, werkwoordenmunt, dialogen, inventaris, kaart, opslaan/laden, minispellen, Smacker-films en XMIDI-muziek met de eigen instrumentenbank.

**Er zitten geen spelbestanden in deze repo.** De app laadt de bestanden rechtstreeks uit de ISO op [archive.org](https://archive.org/details/ronja-de-roversdochter) (of uit je eigen ISO/CD) en bewaart ze in de browsercache. Ook de keuzezinnen van de dialogen worden bij het starten uit `language.str` op de CD gelezen.

## Ontwikkelen

```bash
npm install
npm run dev
```

Zie [docs/engine-api.md](docs/engine-api.md) voor de opbouw (scènes, hooks, minispellen) en `tools/steps/` voor headless tests met `node tools/browse.mjs`.

## Credits

- Smacker-decoder, XMIDI/DLS-conversie en de engine zijn eigen implementaties op basis van de reverse-engineering in `docs/re/`.
- MIDI-synthese: [spessasynth_lib](https://github.com/spessasus/spessasynth_lib) (Apache-2.0); terugval-soundfont GeneralUser GS (S. Christian Collins, vrij te verspreiden).
- AI-opschaling: Real-ESRGAN `realesr-general-x4v3` (BSD-3-Clause) via onnxruntime-web.
