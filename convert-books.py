#!/usr/bin/env python3
"""
Konvertér ChatGPT-genereret bogliste (tabel-format) til books.json

Brug:
  1. Få ChatGPT til at generere boglisten (brug prompt fra chatgpt-biblioteks-bogliste-prompt.txt)
  2. Kopier tabellen fra ChatGPT (fra "Nr | Titel | Forfatter..." til sidste bog)
  3. Gem det i en fil, fx chatgpt-output.txt
  4. Kør: python3 convert-books.py chatgpt-output.txt
  5. Resultat gemmes som static/data/books-new.json (tjek den før du omdøber til books.json)

Forventet format fra ChatGPT:
Nr | Titel | Forfatter | Genre | Kort beskrivelse | Hvorfor den passer | DK biblioteks-sandsynlighed
---|-------|-----------|-------|-----------------|-------------------|-------------------------
1  | Titel | Forfatter | Genre | Beskrivelse     | Grund              | Høj/Middel/Lav

Scriptet håndterer:
- Danske tegn (æ, ø, å)
- Mangel på data (bruger defaults)
- Genererer id'er automatisk (bog-001, bog-002, osv)
"""

import sys
import re
import json
from pathlib import Path

def parse_table_row(row):
    """Parse en tabel-række fra ChatGPT output."""
    # Split på | og ryd whitespace
    cells = [cell.strip() for cell in row.split("|")]
    
    # Filtrer tomme celler (typisk fra start/slut af linjen)
    cells = [c for c in cells if c]
    
    if len(cells) < 3:
        return None
    
    # Forventet: [nr, titel, forfatter, genre, beskrivelse, grund, sandsynlighed]
    # Men håndtér tilfælde hvor nogle celler er tomme
    result = {
        "nr": cells[0] if len(cells) > 0 else "",
        "titel": cells[1] if len(cells) > 1 else "",
        "forfatter": cells[2] if len(cells) > 2 else "",
        "genre": cells[3] if len(cells) > 3 else "",
        "beskrivelse": cells[4] if len(cells) > 4 else "",
        "grund": cells[5] if len(cells) > 5 else "",
        "sandsynlighed": cells[6] if len(cells) > 6 else "",
    }
    
    # Tjek at vi har mindst titel og forfatter
    if not result["titel"] or not result["forfatter"]:
        return None
    
    return result

def convert_to_books_json(rows):
    """Konvertér parsed rows til books.json format."""
    books = []
    book_id = 1
    
    for row in rows:
        if not row:
            continue
        
        titel = row["titel"].strip()
        forfatter = row["forfatter"].strip()
        genre = row["genre"].strip()
        beskrivelse = row["beskrivelse"].strip()
        grund = row["grund"].strip()
        
        # Spring over hvis titel er tom
        if not titel or titel.lower() in ("titel", ""):
            continue
        
        # Lav tags fra genre og grund
        tags = []
        for word in genre.split(","):
            tag = word.strip().lower()
            if tag and tag not in ("", "genre"):
                tags.append(tag)
        
        # Tilføj "gyser" hvis det virker relevant fra grund
        if "gyser" in beskrivelse.lower() and "gyser" not in tags:
            tags.append("gyser")
        
        # Fjern duplikater og sortér
        tags = sorted(list(set(tags)))
        
        # Lav short_pitch fra første del af beskrivelse
        short_pitch = beskrivelse.split(".")[0] if beskrivelse else titel
        if len(short_pitch) > 100:
            short_pitch = short_pitch[:97] + "..."
        
        book = {
            "id": f"bog-{book_id:03d}",
            "title": titel,
            "author": forfatter,
            "short_pitch": short_pitch,
            "description": beskrivelse,
            "tags": tags
        }
        
        books.append(book)
        book_id += 1
    
    return books

def main():
    if len(sys.argv) < 2:
        print("Brug: python3 convert-books.py <input-fil>")
        print("\nInput-fil skal indeholde ChatGPT's tabel i format:")
        print("Nr | Titel | Forfatter | Genre | Kort beskrivelse | Hvorfor den passer | DK biblioteks-sandsynlighed")
        print("\nEksempel:")
        print("1 | En mørk hemmelighed | Søren Sveistrup | Gyser, Krimi | Spændende historie | Psykologisk dybde | Høj")
        sys.exit(1)
    
    input_file = Path(sys.argv[1])
    
    if not input_file.exists():
        print(f"Fejl: Filen {input_file} findes ikke.", file=sys.stderr)
        sys.exit(1)
    
    # Læs input-filen
    with input_file.open("r", encoding="utf-8") as f:
        content = f.read()
    
    # Split på linjer
    lines = content.split("\n")
    
    # Filtrer linjer der er tabel-separatorer (-----|-----|...) eller headers
    rows = []
    for line in lines:
        # Skip tomme linjer
        if not line.strip():
            continue
        
        # Skip separator-linjer (som består af - og |)
        if re.match(r"^[\s\-|]+$", line):
            continue
        
        # Skip header-linjer
        if "titel" in line.lower() and "forfatter" in line.lower():
            continue
        
        # Parse rækker som indeholder |
        if "|" in line:
            parsed = parse_table_row(line)
            if parsed:
                rows.append(parsed)
    
    if not rows:
        print("Fejl: Ingen boglister fundet i input-filen.", file=sys.stderr)
        print("\nForventet format:")
        print("1 | Titel | Forfatter | Genre | Beskrivelse | Grund | Sandsynlighed")
        sys.exit(1)
    
    # Konvertér til books.json format
    books = convert_to_books_json(rows)
    
    if not books:
        print("Fejl: Ingen bøger kunne ekstrahereres.", file=sys.stderr)
        sys.exit(1)
    
    # Gem resultat
    output_file = Path(__file__).parent / "static" / "data" / "books-new.json"
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    with output_file.open("w", encoding="utf-8") as f:
        json.dump(books, f, ensure_ascii=False, indent=2)
    
    print(f"✓ Konverteret {len(books)} bøger")
    print(f"✓ Gemt til: {output_file}")
    print("\nNæste trin:")
    print(f"  1. Tjek filen: {output_file}")
    print(f"  2. Hvis den ser rigtig ud, omdøb den til static/data/books.json")
    print("  3. Genstart appen med: OLLAMA_MODEL=norma-assistent python3 app.py --host 0.0.0.0 --port 5000 --mock-bridge")
    print("  4. Test på: http://localhost:5000/talk.html")

if __name__ == "__main__":
    main()
