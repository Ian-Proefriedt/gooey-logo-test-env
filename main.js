import * as THREE from 'three';

// Import shaders as text
import vertexShader from './vertex.glsl?raw';
import fragmentShader from './fragment.glsl?raw';

class ShaderPlane {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });

        // --- Uniforms for shader ---
        this.uniforms = {
            uTime: { value: 0 },
            uResolution: { value: new THREE.Vector2() },
            uSmoothness: { value: 0.07 }, // gooey bridge strength
            uSwap: { value: 0 },          // toggles between diagonal layouts
            uSpacing: { value: 0.20 }     // distance of squares from center
        };

        // --- Animation state ---
        this.targetSwap = 0; // where we want uSwap to animate toward

        this.init();
        this.setupPlane();
        this.setupEventListeners();
        this.animate();
    }

    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(this.renderer.domElement);

        // Set initial resolution
        this.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    }

    setupPlane() {
        // Fullscreen plane
        const geometry = new THREE.PlaneGeometry(2, 2);

        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader
        });

        const plane = new THREE.Mesh(geometry, material);
        this.scene.add(plane);
    }

    setupEventListeners() {
        window.addEventListener('resize', this.onResize.bind(this));

        // Toggle between layouts on click
        window.addEventListener('click', () => {
            this.targetSwap = this.targetSwap === 0 ? 1 : 0;
        });
    }

    onResize() {
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
    
        // --- Springy interpolation for uSwap ---
        const stiffness = 0.10;  // spring strength (higher = tighter)
        const damping = 0.65;    // damping factor (lower = bouncier)
    
        // Ensure velocity exists
        if (this.swapVelocity === undefined) this.swapVelocity = 0;
    
        // Spring calculation
        const delta = this.targetSwap - this.uniforms.uSwap.value;
        this.swapVelocity += delta * stiffness;
        this.swapVelocity *= damping;
        this.uniforms.uSwap.value += this.swapVelocity;
    
        // Update time
        this.uniforms.uTime.value = performance.now() * 0.001;
    
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the app
new ShaderPlane();
