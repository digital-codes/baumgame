import {
    Scene, Engine, HemisphericLight, MeshBuilder,
    Mesh, Vector3, Color3, Color4, StandardMaterial,
    PointLight, AbstractMesh, Viewport,
    FollowCamera, FreeCamera,
    ArcRotateCamera, FlyCamera,
    DirectionalLight,
    type Nullable,
    PBRMaterial
} from '@babylonjs/core';

import { ImportMeshAsync, InstancedMesh } from "@babylonjs/core";
//import { Engine, Scene, ArcRotateCamera, AnimationGroup, HemisphericLight, MotorEnabledJoint, Vector3, Mesh, AbstractMesh, ImportMeshAsync, MeshBuilder, StandardMaterial, Texture, Color3, InstancedMesh } from "@babylonjs/core";
//import { PhysicsImpostor, CannonJSPlugin, PhysicsJoint } from "@babylonjs/core/Physics";
//import * as CANNON from "cannon-es";
import "@babylonjs/loaders";
import "@babylonjs/loaders/glTF";


// scene construction imports
//import createGround from './ground';

import { createLeafletTexture, latLonToTileXY } from "./map.ts"
const groundSize = 512
const tileSize = 256
const ngTiles = 0 // neighboring tiles
const USE_UTM32 = true
const zoom = 13
const zoomAdjust = USE_UTM32 ? -4 : 0

const mapCenters = {
    "kaBaum": { lat: 49.009599, lon: 8.403940 },
    "kaBaum1": { lat: 49.0113359939117572, lon: 8.4108178263551050 },
    "kaMarkt": { lat: 49.009229, lon: 8.403903 },
    "kaKunst": { lat: 49.011025, lon: 8.399885 },
    "kaZoo": { lat: 48.99672, lon: 8.40214 },
}

const tileGrid = Array.from({ length: ngTiles * 2 + 1 }, () => Array(ngTiles * 2 + 1).fill(0));
console.log("Tile grid", tileGrid);


const trees_ = await import("@/assets/data/zentrum-alt.json")
console.log("Trees:", trees_)
if (trees_) {
    const trees = trees_.features
    console.log("Trees:", trees.length)
}

let engine: Engine | null = null;

const disposeEngine = function () {
    if (engine) {
        engine.stopRenderLoop();
        window.removeEventListener('resize', function () {
            engine?.resize();
        });
        engine.dispose();
        engine = null;
        console.log("Engine disposed.");
        // --- Remove keyboard listeners ---
    }
}

// helper functions
// Helper: recursively find first mesh with geometry
function findFirstMeshWithGeometry(meshes: AbstractMesh[]): Mesh | null {
    for (const m of meshes) {
        if (m instanceof Mesh && m.getTotalVertices() > 0) return m;
    }
    return null;
}

// Load both GLTF models asynchronously
const loadModel = async (path: string, merge: boolean = false, scene: Scene, setMaterial = false) => {
    const result = await ImportMeshAsync(path, scene);

    // add material if none
    // result contains:
    //   result.meshes      → array of loaded meshes
    //   result.particleSystems, result.skeletons, etc.

    if (setMaterial) {
        const mat = new PBRMaterial("defaultMat", scene);
        mat.albedoColor = new Color3(0.8, 0.8, 0.8); // light gray
        mat.metallic = 0;
        mat.roughness = 1;

        // apply material only to meshes from this import
        for (const mesh of result.meshes) {
            //if (mesh.material) continue;
            //console.log("Assign material", mesh.name)
            mesh.material = mat;
        }

        for (const m of result.meshes) {
            if (m.material) {
                m.material.backFaceCulling = false;
                m.material.alpha = 1.0;
                m.material.alphaMode = Engine.ALPHA_DISABLE;
            }
        }
    }

    // ----------------------

    // List all animation groups and their frame ranges
    const ag = result.animationGroups || [];
    if (ag.length > 0) {
        ag.forEach(group => {
            console.log("Animation Group Name:", group.name);
            console.log("From Frame:", group.from);
            console.log("To Frame:", group.to);
            group.stop();
        });
        // Find a specific animation group by name
        const poseName = "HumanArmature|Man_Idle"; // The pose/animation you want
        const pose = ag.find(g => g.name === poseName);

        if (pose) {
            // Start the pose animation
            console.log(`Starting animation group ${poseName}`);
            pose.goToFrame(pose.from);
            // pose.start(false, 1.0, pose.from, pose.to, false); 
            // (no loop, normal speed, from start frame to end frame, no loop)
        } else {
            console.log(`Animation group ${poseName} not found.`);
        }
    }

    if (merge) {
        const meshes = result.meshes.filter(mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0) as Mesh[];
        if (meshes.length === 0) throw new Error(`No meshes with geometry found in ${path}`);
        meshes.forEach(mesh => mesh.parent = null);
        const merged = Mesh.MergeMeshes(meshes, true, true, undefined, false, true);
        return merged
    } else {
        const mesh = findFirstMeshWithGeometry(result.meshes);
        if (!mesh) throw new Error(`No mesh with geometry found in ${path}`);
        mesh.parent = null;
        return mesh
    }
};


const buildCanvas = async (canvas: HTMLCanvasElement) => {
    if (!canvas) {
        throw new Error('Canvas element not found');
    }
    // Load the 3D engine
    if (engine) {
        console.log("Disposing existing engine.");
        disposeEngine();
    }
    engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    if (!engine) {
        throw new Error('Engine creation failed');
    }
    // CreateScene function that creates and return the scene
    const { scene, camera } = await createScene(engine, canvas);
    if (!scene || !camera || !engine.scenes[0]) {
        throw new Error('Scene or Camera creation failed');
    }
    // define the object update function, before the scene renders.


    engine.scenes[0].beforeRender = function () {
        const dt = scene.getEngine().getDeltaTime() / 1000;

    }

    // test positions 
    // Argentina -18.1042668809, -10.5421525959
    // "crop_x_px": 956.87, "crop_y_px": 1521 956.87, 1521
    // adjust like so: (px - 1500) / 30 for x, and -(py - 904) / 30 for z
    // russia crop_x_px": 2307.29, "crop_y_px": 538
    const marker = MeshBuilder.CreateBox("redCubeMarker", { size: 1 }, scene);
    marker.position = new Vector3((2307.29 - 1500) / 30, .7, -(538 - 904) / 30);
    const markerMat = new StandardMaterial("redCubeMat", scene);
    markerMat.diffuseColor = new Color3(1, 0, 0); // red
    markerMat.specularColor = new Color3(0, 0, 0);
    marker.material = markerMat;

    const marker2 = MeshBuilder.CreateBox("blueCubeMarker", { size: 1 }, scene);
    marker2.position = new Vector3((956 - 1500) / 30, .7, -(1521 - 904) / 30);
    const markerMat2 = new StandardMaterial("blueCubeMat", scene);
    markerMat2.diffuseColor = new Color3(0, 0, 1); // blue
    markerMat2.specularColor = new Color3(0, 0, 0);
    marker2.material = markerMat2;
    // 


    // load the map
    (async () => {
        const ground = MeshBuilder.CreateGround("ground", { width: groundSize, height: groundSize }, scene);

        // select location
        const location = mapCenters.kaBaum
        const gtx = await createLeafletTexture(scene,
            //mapCenters.kaZoo.lat, mapCenters.kaZoo.lon, zoom + zoomAdjust, ngTiles, USE_UTM32);
            location.lat, location.lon, zoom + zoomAdjust, ngTiles, USE_UTM32);
        console.log("groundTexture dims", gtx.dims);

        const centerTileX = gtx.dims[4];
        const centerTileY = gtx.dims[5];

        for (let i = -ngTiles; i <= ngTiles; i++) {
            for (let j = -ngTiles; j <= ngTiles; j++) {
                const tileX = centerTileX + i;
                const tileY = centerTileY + j;
                tileGrid[ngTiles - j][ngTiles + i] = [tileX, tileY];
            }
        }
        console.log("Filled Tile Grid", tileGrid);

        const groundMat = new StandardMaterial("leafletMat", scene);
        groundMat.diffuseTexture = gtx.texture;
        groundMat.specularColor = new Color3(0.5, 0.5, 0.5); // Adjust reflectivity
        groundMat.specularPower = 100; // Control the sharpness of the reflection
        const groundScale = groundSize / gtx.dims[2]; // canvas width in pixels
        console.log("groundScale", groundScale, groundSize, gtx.dims[2]);
        const pxSize = gtx.dims[3];
        const unitSize = pxSize / groundScale
        console.log("ground px / unit size [m]", pxSize, unitSize);
        // compute offset of target to center
        const offsetX = -(gtx.dims[0] - tileSize / 2) * groundScale
        const offsetY = (gtx.dims[1] - tileSize / 2) * groundScale
        console.log("target offset", offsetX, offsetY);

        ground.material = groundMat;
        ground.rotation = new Vector3(0, Math.PI, 0);
    })();
    // 
    // load a tree
    //const treeModel = await loadModel("/models/marktplatz3.glb", true, scene, true);
    //const treeModel = await loadModel("/models/flach.glb", true, scene);
    const treeModel = await loadModel("/models/tree1.glb", true, scene);
    treeModel!.computeWorldMatrix(true);
    const treeBoundingInfo = treeModel!.getBoundingInfo();
    console.log("Model bbox:", treeBoundingInfo)
    const treeSize = treeBoundingInfo.boundingBox.maximumWorld.subtract(treeBoundingInfo.boundingBox.minimumWorld);
    console.log("Tree model size", treeSize);
    const treeMaxDim = Math.max(treeSize.x, treeSize.y, treeSize.z);
    console.log("Max dim:", treeMaxDim)
    const treeTargetSize = 20.0;
    const treeScaleFactor = treeTargetSize / treeMaxDim;
    treeModel!.scaling.scaleInPlace(treeScaleFactor) // new Vector3(.00001,.01,.00001)) // treeScaleFactor);
    // get model's Y position to ensure base is above ground on instances
    const treeBoundingBox = treeModel!.getBoundingInfo().boundingBox;
    const treeBaseY = .01 // treeBoundingBox.minimumWorld.y;
    treeModel!.position = new Vector3(0, treeBaseY, 0)

    if (!treeModel) {
        console.error("Tree model not found");
        throw new Error("Tree model not found");
    }
    console.log("Tree model", treeModel);
    treeModel.setEnabled(true);
    treeModel.isVisible = true;

    // load building
    //const bldModel = await loadModel("/models/marktplatz3.glb", true, scene, true);
    const bldModel = await loadModel("/models/flach.glb", true, scene,true);
    const bldBoundingInfo = bldModel!.getBoundingInfo();
    console.log("Building Model bbox:", bldBoundingInfo)

    // Babylon origin (UTM32 reference point)
    const REF_EASTING = 456463.942;
    const REF_NORTHING = 5428482.729;

    // meters → Babylon units
    const SCALE = 0.1;

    // Converts old UTM-aligned GLB positions into Babylon world space
    function placeUTMModel(mesh, centerUTM) {
        console.log("Placing UTM model at:", centerUTM);
        // UTM coordinate components (from model metadata or bounding box)
        const easting = centerUTM._x;   // CityJSON X
        const northing = centerUTM._y;   // CityJSON Y
        const height = centerUTM._z;   // CityJSON Z (becomes Babylon Y)

        // Step 1: swap Y/Z for Babylon
        // Step 2: offset relative to reference origin
        const bx = (easting - REF_EASTING) * SCALE;
        const bz = (northing - REF_NORTHING) * SCALE;

        // Step 3: flatten base height (Y = 0)
        const by = 0;

        const bldBoundingInfo = mesh!.getBoundingInfo();
        console.log("Building Model bbox:", bldBoundingInfo)
        const bldtreeSize = bldBoundingInfo.boundingBox.maximumWorld.subtract(bldBoundingInfo.boundingBox.minimumWorld);
        const bldMaxDim = Math.max(bldtreeSize.x, bldtreeSize.y, bldtreeSize.z);
        const bldTargetSize = 20.0;
        console.log("Max dim:", bldMaxDim)
        const bldScaleFactor = bldTargetSize / bldMaxDim;
        mesh!.scaling.scaleInPlace(bldScaleFactor)

        const newBldBoundingInfo = mesh!.getBoundingInfo();
        console.log("New building Model bbox:", newBldBoundingInfo)

        // Step 4: apply transform
        mesh.position = new Vector3(bx, by, bz);

        console.log(`Placed at Babylon coords: (${bx.toFixed(2)}, ${by.toFixed(2)}, ${bz.toFixed(2)})`);
        console.log("scale", mesh.scaling);

    }

    // placeUTMModel(bldModel, bldBoundingInfo.boundingBox.centerWorld);
    /**/
    bldModel!.computeWorldMatrix(true);
    //const bldBoundingInfo = bldModel!.getBoundingInfo();
    console.log("Building Model bbox:", bldBoundingInfo)
    const bldtreeSize = bldBoundingInfo.boundingBox.maximumWorld.subtract(bldBoundingInfo.boundingBox.minimumWorld);
    console.log("Bld model size", bldtreeSize);
    const  bldMaxDim = Math.max(bldtreeSize.x, bldtreeSize.y, bldtreeSize.z);
    console.log("Max dim:", bldMaxDim)
    const bldTargetSize = 20.0;
    const bldScaleFactor = bldTargetSize / bldMaxDim;
    bldModel!.scaling.scaleInPlace(bldScaleFactor) // new Vector3(.00001,.01,.00001)) // treeScaleFactor);
    // get model's Y position to ensure base is above ground on instances
    const bldBoundingBox = bldModel!.getBoundingInfo().boundingBox;
    const bldBaseY = .01 // bldBoundingBox.minimumWorld.y;
    bldModel!.position = new Vector3(0, bldBaseY, 0)
    /* */

    if (!bldModel) {
        console.error("Building model not found");
        throw new Error("Building model not found");
    }
    console.log("Building model", bldModel);
    bldModel.setEnabled(true);
    bldModel.isVisible = true;

    // ---------------------
    console.log("Env Texture:", scene.environmentTexture);             // should be a valid environment texture (HDR .env)
    console.log("Tone Mapping Enabled:", scene.imageProcessingConfiguration.toneMappingEnabled); // true if HDR tone mapping active
    // Guard access because scene.getEngine() returns AbstractEngine in types; cast or check before reading isHDR
    const _eng = scene.getEngine();
    console.log('isHDR' in _eng ? (_eng as any).isHDR : false);              // Babylon 8+ engine-level HDR flag


    // call resize from parent, if required

    // run the render loop
    engine.runRenderLoop(function () {
        scene.render();
    });

    return canvas;
}

const createScene = async function (engine: Engine, canvas: HTMLCanvasElement): Promise<{
    scene: Scene,
    camera: FreeCamera | ArcRotateCamera | FlyCamera | FollowCamera, birdCam: FreeCamera
}> {
    // Create a basic BJS Scene object
    var scene = new Scene(engine);
    if (!scene) {
        throw new Error('Scene creation failed');
    }
    // Create a FreeCamera, and set its position to {x: 0, y: 5, z: -10}
    let camera: ArcRotateCamera | FlyCamera | FreeCamera | FollowCamera;

    camera = new ArcRotateCamera("ArcRotateCamera", Math.PI / 2, Math.PI / 4, 20, Vector3.Zero(), scene);
    (camera as ArcRotateCamera).attachControl(canvas, true);
    // --- Smoothness tweaks ---
    (camera as ArcRotateCamera).wheelPrecision = 100;                // 🟢 smaller = faster zoom; larger = slower
    (camera as ArcRotateCamera).wheelDeltaPercentage = 0.01;         // 🟢 smooth zoom with percentage-based delta
    (camera as ArcRotateCamera).inertia = 0.9;                       // 🟢 smoothing after movement (0 = immediate)
    (camera as ArcRotateCamera).panningInertia = 0.9;                // 🟢 same for panning
    (camera as ArcRotateCamera).lowerRadiusLimit = 2;                // optional min zoom distance
    (camera as ArcRotateCamera).upperRadiusLimit = 5000;              // optional max zoom distance
    // Target the camera to scene origin
    (camera as ArcRotateCamera).setTarget(Vector3.Zero());




    // Set each camera’s viewport
    // (x, y, width, height) are normalized 0–1
    camera.viewport = new Viewport(0, 0, 1.0, 1.0);          // full screen
    //birdCam.viewport  = new Viewport(.80, 0.88, 0.20, 0.12);  // small upper-right corner

    // Add both cameras to scene
    scene.activeCameras = [camera];


    /*
    scene.createDefaultEnvironment({
        environmentTexture: undefined, // use built-in neutral HDR if none provided
    });
    */

    scene.clearColor = new Color4(0, 0, 0, 1);


    // Have the Camera orbit the sun (third value moves camera away from center).

    const galacticlight = new HemisphericLight('galacticlight', new Vector3(0, 1, 0), scene);

    const newHemiLight = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);

    galacticlight.intensity = 0.5;

    galacticlight.groundColor = new Color3(0.5, 0.5, 1.0);

    // some direct light for the glider
    // Directional sunlight
    const sun = new DirectionalLight("sun", new Vector3(-1, -2, 1), scene);
    sun.position = new Vector3(2, 50, -2);
    sun.intensity = .20;




    return { scene, camera };
}


const resizeGame = function () {
    console.log("Resizing game canvas.");
    if (engine) {
        engine.resize();
    }
}

export { buildCanvas, disposeEngine, resizeGame };
