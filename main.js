import * as THREE from 'three';
import { GUI } from 'lil-gui';

import vertexShader from './vertex.glsl?raw';
import fragmentShader from './fragment.glsl?raw';

class ShaderPlane {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });

        // --- Shader uniforms ---
        this.uniforms = {
            uTime: { value: 0 },
            uResolution: { value: new THREE.Vector2() },

            uSquare1Pos: { value: new THREE.Vector2(-0.20, 0.20) },
            uSquare2Pos: { value: new THREE.Vector2(0.0, 0.0) },
            uSquare3Pos: { value: new THREE.Vector2(0.20, -0.20) },

            uSquareSize: { value: 0.10 },
            uCornerRadius: { value: 0.03 },

            uSmoothness: { value: 0.1 },
            uElasticity: { value: 1.0 }, // NEW uniform

            uMaxGooeyDistance: { value: 0.8 },
            uMinGooeyDistance: { value: 0.15 },
            uMinConnectionStrength: { value: 0.5 },
            uConnectionRange: { value: 0.4 }
        };

        this.isSwapped = false;
        this.isAnimating = false;

        this.defaultPositions = {
            square1: new THREE.Vector2(-0.20, 0.20),
            square3: new THREE.Vector2(0.20, -0.20)
        };
        this.swappedPositions = {
            square1: new THREE.Vector2(0.20, 0.20),
            square3: new THREE.Vector2(-0.20, -0.20)
        };

        this.init();
        this.setupPlane();
        this.setupEventListeners();
        this.setupGUI();
        this.animate();
    }

    setupGUI() {
        this.gui = new GUI({ title: 'Gooey Logo Controls' });

        this.params = {
            square1X: this.uniforms.uSquare1Pos.value.x,
            square1Y: this.uniforms.uSquare1Pos.value.y,
            square2X: this.uniforms.uSquare2Pos.value.x,
            square2Y: this.uniforms.uSquare2Pos.value.y,
            square3X: this.uniforms.uSquare3Pos.value.x,
            square3Y: this.uniforms.uSquare3Pos.value.y,

            squareSize: this.uniforms.uSquareSize.value,
            cornerRadius: this.uniforms.uCornerRadius.value,

            smoothness: this.uniforms.uSmoothness.value,
            elasticity: this.uniforms.uElasticity.value, // NEW GUI param
            maxDistance: this.uniforms.uMaxGooeyDistance.value,
            minDistance: this.uniforms.uMinGooeyDistance.value,
            minStrength: this.uniforms.uMinConnectionStrength.value,
            connectionRange: this.uniforms.uConnectionRange.value,

            resetPositions: () => this.resetToDefaults(),
            triggerSwap: () => this.toggleSwap()
        };

        const positionsFolder = this.gui.addFolder('Square Positions');
        positionsFolder.add(this.params, 'square1X', -1, 1, 0.01).onChange(v => this.uniforms.uSquare1Pos.value.x = v);
        positionsFolder.add(this.params, 'square1Y', -1, 1, 0.01).onChange(v => this.uniforms.uSquare1Pos.value.y = v);
        positionsFolder.add(this.params, 'square2X', -1, 1, 0.01).onChange(v => this.uniforms.uSquare2Pos.value.x = v);
        positionsFolder.add(this.params, 'square2Y', -1, 1, 0.01).onChange(v => this.uniforms.uSquare2Pos.value.y = v);
        positionsFolder.add(this.params, 'square3X', -1, 1, 0.01).onChange(v => this.uniforms.uSquare3Pos.value.x = v);
        positionsFolder.add(this.params, 'square3Y', -1, 1, 0.01).onChange(v => this.uniforms.uSquare3Pos.value.y = v);

        const shapeFolder = this.gui.addFolder('Shape Properties');
        shapeFolder.add(this.params, 'squareSize', 0.01, 0.3, 0.001).onChange(v => this.uniforms.uSquareSize.value = v);
        shapeFolder.add(this.params, 'cornerRadius', 0, 0.1, 0.001).onChange(v => this.uniforms.uCornerRadius.value = v);

        const gooeyFolder = this.gui.addFolder('Gooey Connections');
        gooeyFolder.add(this.params, 'smoothness', 0, 0.3, 0.001).onChange(v => this.uniforms.uSmoothness.value = v);
        gooeyFolder.add(this.params, 'elasticity', 0.5, 2.0, 0.01).onChange(v => this.uniforms.uElasticity.value = v);
        gooeyFolder.add(this.params, 'maxDistance', 0.1, 2, 0.01).onChange(v => this.uniforms.uMaxGooeyDistance.value = v);
        gooeyFolder.add(this.params, 'minDistance', 0, 0.5, 0.01).onChange(v => this.uniforms.uMinGooeyDistance.value = v);
        gooeyFolder.add(this.params, 'minStrength', 0, 1, 0.01).onChange(v => this.uniforms.uMinConnectionStrength.value = v);
        gooeyFolder.add(this.params, 'connectionRange', 0, 1, 0.01).onChange(v => this.uniforms.uConnectionRange.value = v);

        const actionsFolder = this.gui.addFolder('Actions');
        actionsFolder.add(this.params, 'resetPositions').name('Reset to Defaults');
        actionsFolder.add(this.params, 'triggerSwap').name('Trigger Swap Animation');

        positionsFolder.open();
        gooeyFolder.open();
    }

    resetToDefaults() {
        this.uniforms.uSquare1Pos.value.set(-0.2, 0.2);
        this.uniforms.uSquare2Pos.value.set(0.0, 0.0);
        this.uniforms.uSquare3Pos.value.set(0.2, -0.2);

        this.params.square1X = -0.2;
        this.params.square1Y = 0.2;
        this.params.square2X = 0.0;
        this.params.square2Y = 0.0;
        this.params.square3X = 0.2;
        this.params.square3Y = -0.2;

        this.gui.updateDisplay();
    }

    toggleSwap() {
        if (this.isAnimating) return;

        this.isAnimating = true;
        this.isSwapped = !this.isSwapped;

        const targetPos1 = this.isSwapped ? this.swappedPositions.square1 : this.defaultPositions.square1;
        const targetPos3 = this.isSwapped ? this.swappedPositions.square3 : this.defaultPositions.square3;

        const startPos1 = this.uniforms.uSquare1Pos.value.clone();
        const startPos3 = this.uniforms.uSquare3Pos.value.clone();

        const duration = 1000;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1.0);
            const easeProgress = this.easeOutElastic(progress);

            this.uniforms.uSquare1Pos.value.lerpVectors(startPos1, targetPos1, easeProgress);
            this.uniforms.uSquare3Pos.value.lerpVectors(startPos3, targetPos3, easeProgress);

            if (progress < 1.0) requestAnimationFrame(animate);
            else this.isAnimating = false;
        };

        requestAnimationFrame(animate);
    }

    easeOutElastic(t) {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) *
            Math.sin((t * 10 - 0.75) * c4) + 1;
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(this.renderer.domElement);
        this.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    }

    setupPlane() {
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
    }

    onResize() {
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.uniforms.uTime.value = performance.now() * 0.001;
        this.renderer.render(this.scene, this.camera);
    }
}

const shaderPlane = new ShaderPlane();
window.shaderPlane = shaderPlane;