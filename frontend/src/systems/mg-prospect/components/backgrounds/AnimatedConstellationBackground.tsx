import { useEffect, useRef } from 'react';

// Color Palette for particles and lines
const PARTICLE_COLORS = [
    'rgba(201, 162, 77, 0.75)',
    'rgba(228, 201, 120, 0.55)',
    'rgba(245, 242, 234, 0.28)'
];

const GLOW_COLORS = [
    'rgba(201, 162, 77, 0.18)',
    'rgba(228, 201, 120, 0.10)'
];

class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;
    glow: string;

    constructor(canvasWidth: number, canvasHeight: number) {
        this.x = Math.random() * canvasWidth;
        this.y = Math.random() * canvasHeight;
        // Low velocity for elegant movement
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = (Math.random() - 0.5) * 0.3;
        this.radius = Math.random() * 1.5 + 0.5; // Small particles (0.5 to 2px)
        this.color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
        this.glow = GLOW_COLORS[Math.floor(Math.random() * GLOW_COLORS.length)];
    }

    update(canvasWidth: number, canvasHeight: number, isReducedMotion: boolean) {
        if (!isReducedMotion) {
            this.x += this.vx;
            this.y += this.vy;
        }

        // Bounce off edges smoothly
        if (this.x < 0 || this.x > canvasWidth) this.vx *= -1;
        if (this.y < 0 || this.y > canvasHeight) this.vy *= -1;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        
        // Add subtle glow
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.glow;
        ctx.fill();
        
        // Reset shadow for performance
        ctx.shadowBlur = 0;
    }
}

export function AnimatedConstellationBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let particles: Particle[] = [];
        
        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const resizeCanvas = () => {
            const dpr = window.devicePixelRatio || 1;
            // Use window inner dimensions
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            
            // CSS size
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;
            
            ctx.scale(dpr, dpr);
            
            initParticles();
        };

        const initParticles = () => {
            particles = [];
            const width = window.innerWidth;
            
            // Determine particle count based on screen width
            let particleCount = 25; // mobile
            if (width >= 1024) particleCount = 70; // desktop
            else if (width >= 768) particleCount = 45; // tablet

            // If reduced motion, show even fewer particles
            if (prefersReducedMotion) {
                particleCount = Math.floor(particleCount * 0.5);
            }

            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle(window.innerWidth, window.innerHeight));
            }
        };

        const drawLines = () => {
            const maxDistance = window.innerWidth >= 1024 ? 150 : 120;
            
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < maxDistance) {
                        // Keep center cleaner by checking distance from center
                        const centerX = window.innerWidth / 2;
                        const centerY = window.innerHeight / 2;
                        const distFromCenterI = Math.sqrt(Math.pow(particles[i].x - centerX, 2) + Math.pow(particles[i].y - centerY, 2));
                        const distFromCenterJ = Math.sqrt(Math.pow(particles[j].x - centerX, 2) + Math.pow(particles[j].y - centerY, 2));
                        
                        // Fade out lines in the center to give space to the login card
                        let centerFade = 1;
                        const minCenterDist = Math.min(distFromCenterI, distFromCenterJ);
                        if (minCenterDist < 300) {
                            centerFade = Math.max(0.1, minCenterDist / 300);
                        }

                        // Opacity based on distance between particles and distance from center
                        const opacity = (1 - distance / maxDistance) * centerFade;
                        
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        
                        // Use the base color of the first particle to determine line color
                        // We use a base gold color and apply calculated opacity
                        ctx.strokeStyle = `rgba(201, 162, 77, ${0.2 * opacity})`;
                        ctx.lineWidth = 0.6;
                        ctx.stroke();
                    }
                }
            }
        };

        const animate = () => {
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

            // Draw and update particles
            particles.forEach((particle) => {
                particle.update(window.innerWidth, window.innerHeight, prefersReducedMotion);
                particle.draw(ctx);
            });

            // Draw constellation lines
            drawLines();

            animationFrameId = requestAnimationFrame(animate);
        };

        // Initialize
        resizeCanvas();
        animate();

        // Listeners
        window.addEventListener('resize', resizeCanvas);

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="fixed inset-0 pointer-events-none z-0"
            style={{ 
                background: '#08090B', // Slightly dark base, but we rely on external gradients
                opacity: 0.8
            }}
        />
    );
}
