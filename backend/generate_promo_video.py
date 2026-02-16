import asyncio
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/backend/.env')

from emergentintegrations.llm.openai.video_generation import OpenAIVideoGeneration

# Output directory
OUTPUT_DIR = "/app/frontend/public/promo"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def generate_video(prompt, filename, duration=12):
    """Generate a single video clip"""
    print(f"\n🎬 Generating: {filename}")
    print(f"   Prompt: {prompt[:80]}...")
    
    video_gen = OpenAIVideoGeneration(api_key=os.environ['EMERGENT_LLM_KEY'])
    
    video_bytes = video_gen.text_to_video(
        prompt=prompt,
        model="sora-2",
        size="1280x720",
        duration=duration,
        max_wait_time=600
    )
    
    if video_bytes:
        output_path = os.path.join(OUTPUT_DIR, filename)
        video_gen.save_video(video_bytes, output_path)
        print(f"   ✅ Saved: {output_path}")
        return output_path
    else:
        print(f"   ❌ Failed to generate")
        return None

def main():
    # Video 1: Motorcycle dealership opening shot
    prompts = [
        {
            "filename": "clip1_motorcycles.mp4",
            "prompt": "Cinematic shot of a premium motorcycle dealership showroom, rows of shiny sport motorcycles (Kawasaki, Honda, BMW, Yamaha) gleaming under professional lighting, camera slowly panning across the bikes, modern industrial interior design, 4K quality, professional commercial video",
            "duration": 12
        },
        {
            "filename": "clip2_technology.mp4",
            "prompt": "Close-up of a smartphone displaying a modern business app interface with motorcycle images, person's hands scrolling through the app, professional office environment in background, soft natural lighting, focus on the screen showing motorcycle catalog, 4K commercial quality",
            "duration": 12
        },
        {
            "filename": "clip3_network.mp4",
            "prompt": "Wide aerial shot of the Netherlands landscape with multiple motorcycle dealerships connected by glowing network lines, modern visualization of a business network, professional corporate video style, blue and white color scheme, 4K cinematic quality",
            "duration": 8
        },
        {
            "filename": "clip4_handshake.mp4",
            "prompt": "Professional business handshake between two dealers in a motorcycle showroom, motorcycles visible in background, warm lighting, successful partnership moment, corporate commercial style, confident businessmen, 4K quality",
            "duration": 8
        }
    ]
    
    results = []
    for video_info in prompts:
        result = generate_video(
            video_info["prompt"],
            video_info["filename"],
            video_info["duration"]
        )
        results.append(result)
    
    print("\n" + "="*50)
    print("📹 VIDEO GENERATION COMPLETE")
    print("="*50)
    
    success = [r for r in results if r]
    print(f"\nGenerated {len(success)}/{len(prompts)} clips:")
    for r in success:
        print(f"  - {r}")
    
    print(f"\nFiles location: {OUTPUT_DIR}")
    print("\nU kunt deze clips combineren tot één video met een video editor,")
    print("of ze individueel gebruiken voor sociale media.")

if __name__ == "__main__":
    main()
