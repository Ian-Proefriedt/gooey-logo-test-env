import * as THREE from 'three';
import { GUI } from 'lil-gui';

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
            // Global uniforms
            uTime: { value: 0 },
            uResolution: { value: new THREE.Vector2() },
            
            // Individual square positions (JavaScript-controlled)
            uSquare1Pos: { value: new THREE.Vector2(-0.20, 0.20) },  // Top-left default
            uSquare2Pos: { value: new THREE.Vector2(0.0, 0.0) },     // Center
            uSquare3Pos: { value: new THREE.Vector2(0.20, -0.20) },  // Bottom-right default
            
            // Note: Rotation and scale uniforms removed - not currently needed
            
            // Shape properties
            uSquareSize: { value: 0.10 },      // Half-size of squares
            uCornerRadius: { value: 0.03 },    // Corner radius for rounded squares
            
            // Gooey effect properties
            uSmoothness: { value: 0.1 },      // Gooey bridge strength
            
            // Distance-aware gooey controls
            uMaxGooeyDistance: { value: 0.8 },     // Maximum distance for any connection
            uMinGooeyDistance: { value: 0.15 },    // Distance where falloff starts
            uMinConnectionStrength: { value: 0.5 }, // Minimum strength multiplier (0.0-1.0)
            uConnectionRange: { value: 0.4 }       // Range where minimum strength is guaranteed
        };

        // --- Animation state ---
        this.isSwapped = false; // current swap state
        this.isAnimating = false; // prevent multiple simultaneous animations
        
        // Target positions for swap animation
        this.defaultPositions = {
            square1: new THREE.Vector2(-0.20, 0.20),   // Top-left
            square3: new THREE.Vector2(0.20, -0.20)    // Bottom-right
        };
        this.swappedPositions = {
            square1: new THREE.Vector2(0.20, 0.20),    // Top-right
            square3: new THREE.Vector2(-0.20, -0.20)   // Bottom-left
        };

        this.init();
        this.setupPlane();
        this.setupEventListeners();
        this.setupGUI();
        this.animate();
    }

    // --- GUI Setup ---
    setupGUI() {
        this.gui = new GUI({ title: 'Gooey Logo Controls' });
        
        // Create parameter object for GUI
        this.params = {
            // Square positions
            square1X: this.uniforms.uSquare1Pos.value.x,
            square1Y: this.uniforms.uSquare1Pos.value.y,
            square2X: this.uniforms.uSquare2Pos.value.x,
            square2Y: this.uniforms.uSquare2Pos.value.y,
            square3X: this.uniforms.uSquare3Pos.value.x,
            square3Y: this.uniforms.uSquare3Pos.value.y,
            
            // Shape properties
            squareSize: this.uniforms.uSquareSize.value,
            cornerRadius: this.uniforms.uCornerRadius.value,
            
            // Gooey parameters
            smoothness: this.uniforms.uSmoothness.value,
            maxDistance: this.uniforms.uMaxGooeyDistance.value,
            minDistance: this.uniforms.uMinGooeyDistance.value,
            minStrength: this.uniforms.uMinConnectionStrength.value,
            connectionRange: this.uniforms.uConnectionRange.value,
            
            // Actions
            resetPositions: () => this.resetToDefaults(),
            triggerSwap: () => this.toggleSwap()
        };
        
        // Square Positions folder
        const positionsFolder = this.gui.addFolder('Square Positions');
        positionsFolder.add(this.params, 'square1X', -1, 1, 0.01).onChange(v => this.uniforms.uSquare1Pos.value.x = v);
        positionsFolder.add(this.params, 'square1Y', -1, 1, 0.01).onChange(v => this.uniforms.uSquare1Pos.value.y = v);
        positionsFolder.add(this.params, 'square2X', -1, 1, 0.01).onChange(v => this.uniforms.uSquare2Pos.value.x = v);
        positionsFolder.add(this.params, 'square2Y', -1, 1, 0.01).onChange(v => this.uniforms.uSquare2Pos.value.y = v);
        positionsFolder.add(this.params, 'square3X', -1, 1, 0.01).onChange(v => this.uniforms.uSquare3Pos.value.x = v);
        positionsFolder.add(this.params, 'square3Y', -1, 1, 0.01).onChange(v => this.uniforms.uSquare3Pos.value.y = v);
        
        // Shape Properties folder
        const shapeFolder = this.gui.addFolder('Shape Properties');
        shapeFolder.add(this.params, 'squareSize', 0.01, 0.3, 0.001).onChange(v => this.uniforms.uSquareSize.value = v);
        shapeFolder.add(this.params, 'cornerRadius', 0, 0.1, 0.001).onChange(v => this.uniforms.uCornerRadius.value = v);
        
        // Gooey Parameters folder
        const gooeyFolder = this.gui.addFolder('Gooey Connections');
        gooeyFolder.add(this.params, 'smoothness', 0, 0.3, 0.001).onChange(v => this.uniforms.uSmoothness.value = v);
        gooeyFolder.add(this.params, 'maxDistance', 0.1, 2, 0.01).onChange(v => this.uniforms.uMaxGooeyDistance.value = v);
        gooeyFolder.add(this.params, 'minDistance', 0, 0.5, 0.01).onChange(v => this.uniforms.uMinGooeyDistance.value = v);
        gooeyFolder.add(this.params, 'minStrength', 0, 1, 0.01).onChange(v => this.uniforms.uMinConnectionStrength.value = v);
        gooeyFolder.add(this.params, 'connectionRange', 0, 1, 0.01).onChange(v => this.uniforms.uConnectionRange.value = v);
        
        // Actions folder
        const actionsFolder = this.gui.addFolder('Actions');
        actionsFolder.add(this.params, 'resetPositions').name('Reset to Defaults');
        actionsFolder.add(this.params, 'triggerSwap').name('Trigger Swap Animation');
        
        // Open key folders by default
        positionsFolder.open();
        gooeyFolder.open();
    }
    
    // Reset to default positions
    resetToDefaults() {
        this.uniforms.uSquare1Pos.value.set(-0.2, 0.2);
        this.uniforms.uSquare2Pos.value.set(0.0, 0.0);
        this.uniforms.uSquare3Pos.value.set(0.2, -0.2);
        
        // Update GUI to reflect changes
        this.params.square1X = -0.2;
        this.params.square1Y = 0.2;
        this.params.square2X = 0.0;
        this.params.square2Y = 0.0;
        this.params.square3X = 0.2;
        this.params.square3Y = -0.2;
        
        this.gui.updateDisplay();
    }

    // --- Helper method for adjusting gooey parameters ---
    setGooeyParams(params) {
        if (params.maxDistance !== undefined) this.uniforms.uMaxGooeyDistance.value = params.maxDistance;
        if (params.minDistance !== undefined) this.uniforms.uMinGooeyDistance.value = params.minDistance;
        if (params.minStrength !== undefined) this.uniforms.uMinConnectionStrength.value = params.minStrength;
        if (params.connectionRange !== undefined) this.uniforms.uConnectionRange.value = params.connectionRange;
        if (params.smoothness !== undefined) this.uniforms.uSmoothness.value = params.smoothness;
    }

    // --- JavaScript-based swap animation ---
    toggleSwap() {
        if (this.isAnimating) return; // Prevent multiple simultaneous animations
        
        this.isAnimating = true;
        this.isSwapped = !this.isSwapped;
        
        // Determine target positions
        const targetPos1 = this.isSwapped ? this.swappedPositions.square1 : this.defaultPositions.square1;
        const targetPos3 = this.isSwapped ? this.swappedPositions.square3 : this.defaultPositions.square3;
        
        // Store current positions for interpolation
        const startPos1 = this.uniforms.uSquare1Pos.value.clone();
        const startPos3 = this.uniforms.uSquare3Pos.value.clone();
        
        // Animation parameters
        const duration = 1000; // milliseconds
        const startTime = performance.now();
        
        // Animation function
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1.0);
            
            // Spring-like easing (similar to original)
            const easeProgress = this.easeOutElastic(progress);
            
            // Interpolate positions
            this.uniforms.uSquare1Pos.value.lerpVectors(startPos1, targetPos1, easeProgress);
            this.uniforms.uSquare3Pos.value.lerpVectors(startPos3, targetPos3, easeProgress);
            
            // Continue animation or finish
            if (progress < 1.0) {
                requestAnimationFrame(animate);
            } else {
                this.isAnimating = false;
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    // Easing function for smooth animation
    easeOutElastic(t) {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
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

        // Click animation removed - use GUI controls instead
    }

    onResize() {
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
    
        // Update time uniform
        this.uniforms.uTime.value = performance.now() * 0.001;
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the app
const shaderPlane = new ShaderPlane();

// Make it globally accessible for console testing
window.shaderPlane = shaderPlane;
