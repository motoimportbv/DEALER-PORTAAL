import os
import sys
sys.path.insert(0, os.path.abspath(''))
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
from emergentintegrations.llm.openai.video_generation import OpenAIVideoGeneration

UPLOAD_DIR = '/app/backend/uploads'

clips = [
    {
        "name": "supplier_clip1.mp4",
        "prompt": (
            "Cinematic aerial drone shot of a large modern motorcycle dealership building with the text "
            "MOTOIMPORT BV on the dark grey facade. Premium motorcycles visible through glass windows. "
            "Camera swoops down dramatically. European countryside with highways in background. "
            "Professional commercial quality, dramatic lighting, golden hour, 4K cinematic color grading."
        )
    },
    {
        "name": "supplier_clip2.mp4",
        "prompt": (
            "Close-up cinematic shots of premium European motorcycles - Triumph, BMW, KTM - in a "
            "professional showroom. Camera glides smoothly past gleaming chrome engines, polished "
            "bodywork, and leather seats. Digital screens showing motorcycle listings and prices. "
            "A businessman in a suit uses a tablet to browse motorcycle inventory on a professional platform. "
            "Modern office environment, warm lighting, commercial advertisement style, 4K quality."
        )
    },
    {
        "name": "supplier_clip3.mp4",
        "prompt": (
            "Cinematic montage of motorcycle transport logistics across the Netherlands. A professional "
            "truck loaded with new motorcycles drives through Dutch landscapes with windmills and flat green "
            "fields. Arrival at multiple different motorcycle shops and dealerships. Happy dealers receiving "
            "new bikes. Final shot: a map of Netherlands with glowing dots representing 100+ dealer locations. "
            "Professional commercial quality, dynamic camera movements, 4K cinematic."
        )
    }
]

def generate_clip(clip_info):
    name = clip_info["name"]
    output_path = os.path.join(UPLOAD_DIR, name)
    
    if os.path.exists(output_path):
        print(f"{name} already exists, skipping")
        return True
    
    print(f"Generating {name}...")
    video_gen = OpenAIVideoGeneration(api_key=os.environ['EMERGENT_LLM_KEY'])
    
    video_bytes = video_gen.text_to_video(
        prompt=clip_info["prompt"],
        model="sora-2",
        size="1280x720",
        duration=12,
        max_wait_time=900
    )
    
    if video_bytes:
        video_gen.save_video(video_bytes, output_path)
        size = os.path.getsize(output_path)
        print(f"{name} saved! ({size} bytes)")
        return True
    else:
        print(f"{name} FAILED")
        return False

if __name__ == "__main__":
    for i, clip in enumerate(clips):
        try:
            success = generate_clip(clip)
            if success:
                print(f"Clip {i+1}/3 DONE")
            else:
                print(f"Clip {i+1}/3 FAILED")
        except Exception as e:
            print(f"ERROR clip {i+1}: {e}")
            import traceback
            traceback.print_exc()
    print("ALL CLIPS DONE")
