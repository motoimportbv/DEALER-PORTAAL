import os
import sys
import asyncio
sys.path.insert(0, os.path.abspath(''))
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
from emergentintegrations.llm.openai.text_to_speech import OpenAITextToSpeech

UPLOAD_DIR = '/app/backend/uploads'

scripts = {
    "it": {
        "filename": "promo_supplier_it.mp3",
        "voice": "nova",
        "text": (
            "Moto Import BV, la piattaforma leader per motociclette nei Paesi Bassi. "
            "Colleghiamo fornitori internazionali con oltre cento concessionari olandesi. "
            "Registratevi su motoimportbv.nl, caricate le vostre moto con foto e prezzi. "
            "La nostra rete di concessionari vedrà immediatamente la vostra offerta. "
            "Vendete le vostre moto più velocemente. Fate affari con i Paesi Bassi. "
            "Motoimportbv.nl, il vostro accesso al mercato motociclistico olandese."
        )
    },
    "de": {
        "filename": "promo_supplier_de.mp3",
        "voice": "nova",
        "text": (
            "Moto Import BV, die führende Motorrad-Plattform in den Niederlanden. "
            "Wir verbinden internationale Lieferanten mit über hundert niederländischen Motorradhändlern. "
            "Registrieren Sie sich auf motoimportbv.nl, laden Sie Ihre Motorräder mit Fotos und Preisen hoch. "
            "Unser Händlernetzwerk sieht Ihr Angebot sofort. "
            "Verkaufen Sie Ihre Motorräder schneller. Machen Sie Geschäfte mit den Niederlanden. "
            "Motoimportbv.nl, Ihr Tor zum niederländischen Motorradmarkt."
        )
    },
    "fr": {
        "filename": "promo_supplier_fr.mp3",
        "voice": "nova",
        "text": (
            "Moto Import BV, la plateforme moto leader aux Pays-Bas. "
            "Nous connectons les fournisseurs internationaux avec plus de cent concessionnaires néerlandais. "
            "Inscrivez-vous sur motoimportbv.nl, téléchargez vos motos avec photos et prix. "
            "Notre réseau de concessionnaires verra immédiatement votre offre. "
            "Vendez vos motos plus rapidement. Faites des affaires avec les Pays-Bas. "
            "Motoimportbv.nl, votre porte d'entrée vers le marché moto néerlandais."
        )
    }
}

async def generate_audio(lang, info):
    print(f"Generating {lang} audio...")
    tts = OpenAITextToSpeech(api_key=os.environ['EMERGENT_LLM_KEY'])
    output_path = os.path.join(UPLOAD_DIR, info["filename"])
    
    audio_bytes = await tts.generate_speech(
        text=info["text"],
        model="tts-1-hd",
        voice=info["voice"],
        response_format="mp3"
    )
    
    if audio_bytes:
        with open(output_path, 'wb') as f:
            f.write(audio_bytes)
        size = os.path.getsize(output_path)
        print(f"{lang} audio saved: {output_path} ({size} bytes)")
        return True
    else:
        print(f"{lang} audio FAILED")
        return False

async def main():
    for lang, info in scripts.items():
        try:
            await generate_audio(lang, info)
        except Exception as e:
            print(f"ERROR {lang}: {e}")
            import traceback
            traceback.print_exc()
    print("ALL AUDIO DONE")

if __name__ == "__main__":
    asyncio.run(main())
