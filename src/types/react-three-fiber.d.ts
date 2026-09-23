import { ReactThreeFiber } from '@react-three/fiber';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      // Basic elements
      mesh: ReactThreeFiber.Object3DNode<THREE.Mesh, typeof THREE.Mesh>;
      points: ReactThreeFiber.Object3DNode<THREE.Points, typeof THREE.Points>;
      group: ReactThreeFiber.Object3DNode<THREE.Group, typeof THREE.Group>;
      
      // Geometries
      bufferGeometry: ReactThreeFiber.BufferGeometryNode<THREE.BufferGeometry, typeof THREE.BufferGeometry>;
      sphereGeometry: ReactThreeFiber.GeometryNode<THREE.SphereGeometry, typeof THREE.SphereGeometry>;
      ringGeometry: ReactThreeFiber.GeometryNode<THREE.RingGeometry, typeof THREE.RingGeometry>;
      octahedronGeometry: ReactThreeFiber.GeometryNode<THREE.OctahedronGeometry, typeof THREE.OctahedronGeometry>;
      tetrahedronGeometry: ReactThreeFiber.GeometryNode<THREE.TetrahedronGeometry, typeof THREE.TetrahedronGeometry>;
      dodecahedronGeometry: ReactThreeFiber.GeometryNode<THREE.DodecahedronGeometry, typeof THREE.DodecahedronGeometry>;
      
      // Materials
      meshBasicMaterial: ReactThreeFiber.MaterialNode<THREE.MeshBasicMaterial, typeof THREE.MeshBasicMaterial>;
      meshStandardMaterial: ReactThreeFiber.MaterialNode<THREE.MeshStandardMaterial, typeof THREE.MeshStandardMaterial>;
      pointsMaterial: ReactThreeFiber.MaterialNode<THREE.PointsMaterial, typeof THREE.PointsMaterial>;
      spriteMaterial: ReactThreeFiber.MaterialNode<THREE.SpriteMaterial, typeof THREE.SpriteMaterial>;
      
      // Attributes and buffer attributes
      bufferAttribute: ReactThreeFiber.BufferAttributeNode<THREE.BufferAttribute, typeof THREE.BufferAttribute>;
      
      // Lights
      ambientLight: ReactThreeFiber.LightNode<THREE.AmbientLight, typeof THREE.AmbientLight>;
      directionalLight: ReactThreeFiber.LightNode<THREE.DirectionalLight, typeof THREE.DirectionalLight>;
      pointLight: ReactThreeFiber.LightNode<THREE.PointLight, typeof THREE.PointLight>;
      
      // Other elements
      sprite: ReactThreeFiber.Object3DNode<THREE.Sprite, typeof THREE.Sprite>;
      // fog, fogExp2 and color are intentionally not declared here:
      // @react-three/fiber already declares them, and its ColorProps
      // accepts the string form (<color args={["#010206"]} />) that a
      // typeof-Color signature would reject.
    }
  }
}
