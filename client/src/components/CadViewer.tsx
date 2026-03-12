import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Button } from "@/components/ui/button";
import { Download, RotateCcw, Maximize2, Box, FileCode2 } from "lucide-react";

interface CadViewerProps {
  url: string;
  filename: string;
  fileSize?: number | null;
  onClose?: () => void;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExt(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function isStlFile(filename: string) {
  return getFileExt(filename) === "stl";
}

function isObjFile(filename: string) {
  return getFileExt(filename) === "obj";
}

function isViewable(filename: string) {
  return isStlFile(filename) || isObjFile(filename);
}

// ─── STL 3D Viewer ────────────────────────────────────────────────────────────
function StlViewer({ url }: { url: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ triangles: number; size: string } | null>(null);

  const resetCamera = () => {
    if (!controlsRef.current || !cameraRef.current) return;
    controlsRef.current.reset();
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // Grid helper
    const grid = new THREE.GridHelper(200, 20, 0x333355, 0x222244);
    scene.add(grid);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(1, 2, 3);
    scene.add(dirLight1);
    const dirLight2 = new THREE.DirectionalLight(0x4488ff, 0.4);
    dirLight2.position.set(-2, -1, -1);
    scene.add(dirLight2);

    // Camera
    const w = mount.clientWidth || 600;
    const h = mount.clientHeight || 400;
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 10000);
    camera.position.set(0, 100, 200);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 5000;
    controlsRef.current = controls;

    // Load STL
    const loader = new STLLoader();
    loader.load(
      url,
      (geometry) => {
        geometry.computeBoundingBox();
        geometry.computeVertexNormals();

        const bbox = geometry.boundingBox!;
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const center = new THREE.Vector3();
        bbox.getCenter(center);

        // Material: metallic look
        const material = new THREE.MeshPhongMaterial({
          color: 0x4a9eff,
          specular: 0x222222,
          shininess: 80,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.sub(center); // center at origin
        scene.add(mesh);

        // Position camera to fit model
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let camDist = Math.abs(maxDim / Math.sin(fov / 2)) * 0.8;
        camera.position.set(camDist * 0.6, camDist * 0.4, camDist * 0.8);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();

        // Grid position
        grid.position.y = -size.y / 2;

        setInfo({
          triangles: geometry.attributes.position.count / 3,
          size: `${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} mm`,
        });
        setLoading(false);
      },
      undefined,
      (err) => {
        setError("STL konnte nicht geladen werden: " + (err as Error).message);
        setLoading(false);
      }
    );

    // Animate
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const handleResize = () => {
      if (!mount) return;
      const w2 = mount.clientWidth;
      const h2 = mount.clientHeight;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [url]);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full rounded-lg overflow-hidden" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Box className="h-8 w-8 animate-pulse text-primary" />
            <span className="text-sm">Lade 3D-Modell...</span>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
          <div className="text-center text-destructive text-sm px-4">{error}</div>
        </div>
      )}
      {!loading && !error && info && (
        <div className="absolute bottom-2 left-2 bg-background/70 backdrop-blur-sm rounded px-2 py-1 text-xs text-muted-foreground space-x-3">
          <span>▲ {info.triangles.toLocaleString("de-DE")} Dreiecke</span>
          <span>📐 {info.size}</span>
        </div>
      )}
      {!loading && !error && (
        <Button
          size="icon"
          variant="outline"
          className="absolute top-2 right-2 h-7 w-7 bg-background/70 backdrop-blur-sm"
          onClick={resetCamera}
          title="Kamera zurücksetzen"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// ─── Main CadViewer ───────────────────────────────────────────────────────────
export function CadViewer({ url, filename, fileSize }: CadViewerProps) {
  const ext = getFileExt(filename);
  const viewable = isViewable(filename);

  if (!viewable) {
    // STP/STEP/other: show download card
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
        <FileCode2 className="h-16 w-16 text-primary/60" />
        <div>
          <p className="font-medium">{filename}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {ext.toUpperCase()} · {fileSize ? formatBytes(fileSize) : ""}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {ext === "stp" || ext === "step"
              ? "STEP-Dateien können mit FreeCAD, CATIA, SolidWorks oder Fusion 360 geöffnet werden."
              : "Diese Datei kann nicht direkt im Browser angezeigt werden."}
          </p>
        </div>
        <Button asChild className="gap-2">
          <a href={url} download={filename} target="_blank" rel="noopener noreferrer">
            <Download className="h-4 w-4" />
            Herunterladen
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full h-[480px]">
      <StlViewer url={url} />
    </div>
  );
}

// ─── Inline Thumbnail (for file list) ─────────────────────────────────────────
export function CadFileThumbnail({ filename, ext }: { filename: string; ext: string }) {
  const colors: Record<string, string> = {
    stl: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    stp: "text-green-400 bg-green-500/10 border-green-500/20",
    step: "text-green-400 bg-green-500/10 border-green-500/20",
    obj: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    "3mf": "text-orange-400 bg-orange-500/10 border-orange-500/20",
  };
  const cls = colors[ext] ?? "text-muted-foreground bg-muted/20 border-border";
  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-mono ${cls}`}>
      <Box className="h-3 w-3" />
      {ext.toUpperCase()}
    </div>
  );
}
