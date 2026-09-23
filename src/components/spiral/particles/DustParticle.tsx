import { useMemo } from "react";
import * as THREE from "three";

interface DustParticleTextureProps {
  isGlow?: boolean;
}

// Extracted function to create particle textures
export const useDustParticleTexture = ({ isGlow = false }: DustParticleTextureProps = {}) => {
  // Create particle texture for dust particles - more nebula-like with soft edges
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = isGlow ? 128 : 64;
    canvas.height = isGlow ? 128 : 64;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      const size = isGlow ? 64 : 32;
      // Create a more complex gradient for a softer, nebula-like particle
      const gradient = ctx.createRadialGradient(size, size, 0, size, size, size);
      
      if (isGlow) {
        // More diffuse gradient for ethereal glow
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      } else {
        // Standard particle gradient
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.6)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        // Add some texture/noise for more realistic space dust
        for (let i = 0; i < 300; i++) {
          const x = Math.random() * 64;
          const y = Math.random() * 64;
          const radius = Math.random() * 1.5;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.1})`;
          ctx.fill();
        }
      }
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    return new THREE.CanvasTexture(canvas);
  }, [isGlow]);
};

// Helper function to create color variations
export const getColorVariation = (baseColor: THREE.Color, strength: number = 0.05) => {
  const newColor = baseColor.clone();
  
  // Small random shifts in hue
  const hsl: {h: number, s: number, l: number} = {h: 0, s: 0, l: 0};
  newColor.getHSL(hsl);
  
  // Keep exact same hue, only vary saturation and lightness slightly
  hsl.s += (Math.random() - 0.5) * strength;
  hsl.l += (Math.random() - 0.5) * strength;
  
  // Ensure values stay in valid range
  hsl.s = Math.max(0, Math.min(1, hsl.s));
  hsl.l = Math.max(0.2, Math.min(0.9, hsl.l));
  
  newColor.setHSL(hsl.h, hsl.s, hsl.l);
  return newColor;
};
