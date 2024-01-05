import * as THREE from 'three';

/**
 * This is a class to check whether points in a Points object are in a selection area in 3D space
 * This is heavily borrowed from https://github.com/mrdoob/three.js/blob/r160/examples/jsm/interactive/SelectionBox.js
 */

const _frustum = new THREE.Frustum();

const _tmpPoint = new THREE.Vector3();

const _vecNear = new THREE.Vector3();
const _vecTopLeft = new THREE.Vector3();
const _vecTopRight = new THREE.Vector3();
const _vecDownRight = new THREE.Vector3();
const _vecDownLeft = new THREE.Vector3();

const _vecFarTopLeft = new THREE.Vector3();
const _vecFarTopRight = new THREE.Vector3();
const _vecFarDownRight = new THREE.Vector3();
const _vecFarDownLeft = new THREE.Vector3();

const _vectemp1 = new THREE.Vector3();
const _vectemp2 = new THREE.Vector3();
const _vectemp3 = new THREE.Vector3();

interface PointsCollection {
    // object_id : [point_index, point_index, ...]
    [key: number]: number[];
}

class PointSelectionBox {

    camera: THREE.OrthographicCamera | THREE.PerspectiveCamera;
    scene: THREE.Scene;
    startPoint: THREE.Vector3;
    endPoint: THREE.Vector3;
    collection: PointsCollection;
    deep: number;

    constructor(
        camera: THREE.OrthographicCamera | THREE.PerspectiveCamera,
        scene: THREE.Scene,
        deep = Number.MAX_VALUE
    ) {
        this.camera = camera;
        this.scene = scene;
        this.startPoint = new THREE.Vector3();
        this.endPoint = new THREE.Vector3();
        this.collection = {};
        this.deep = deep;
    }

    select(startPoint?: THREE.Vector3, endPoint?: THREE.Vector3) {
        this.startPoint = startPoint ?? this.startPoint;
        this.endPoint = endPoint ?? this.endPoint;
        this.collection = {}

        this.updateFrustum(this.startPoint, this.endPoint);
        this.searchChildInFrustum(_frustum, this.scene);

        return this.collection;
    }

    updateFrustum(startPoint: THREE.Vector3, endPoint: THREE.Vector3) {
        startPoint = startPoint || this.startPoint;
        endPoint = endPoint || this.endPoint;

        // Avoid invalid frustum
        if (startPoint.x === endPoint.x) {
            endPoint.x += Number.EPSILON;
        }

        if (startPoint.y === endPoint.y) {
            endPoint.y += Number.EPSILON;
        }

        this.camera.updateProjectionMatrix();
        this.camera.updateMatrixWorld();

        if (isPerspectiveCamera(this.camera)) {
            _tmpPoint.copy(startPoint);
            _tmpPoint.x = Math.min(startPoint.x, endPoint.x);
            _tmpPoint.y = Math.max(startPoint.y, endPoint.y);
            endPoint.x = Math.max(startPoint.x, endPoint.x);
            endPoint.y = Math.min(startPoint.y, endPoint.y);

            _vecNear.setFromMatrixPosition(this.camera.matrixWorld);
            _vecTopLeft.copy(_tmpPoint);
            _vecTopRight.set(endPoint.x, _tmpPoint.y, 0);
            _vecDownRight.copy(endPoint);
            _vecDownLeft.set(_tmpPoint.x, endPoint.y, 0);

            _vecTopLeft.unproject(this.camera);
            _vecTopRight.unproject(this.camera);
            _vecDownRight.unproject(this.camera);
            _vecDownLeft.unproject(this.camera);

            _vectemp1.copy(_vecTopLeft).sub(_vecNear);
            _vectemp2.copy(_vecTopRight).sub(_vecNear);
            _vectemp3.copy(_vecDownRight).sub(_vecNear);
            _vectemp1.normalize();
            _vectemp2.normalize();
            _vectemp3.normalize();

            _vectemp1.multiplyScalar(this.deep);
            _vectemp2.multiplyScalar(this.deep);
            _vectemp3.multiplyScalar(this.deep);
            _vectemp1.add(_vecNear);
            _vectemp2.add(_vecNear);
            _vectemp3.add(_vecNear);

            const planes = _frustum.planes;

            planes[0].setFromCoplanarPoints(_vecNear, _vecTopLeft, _vecTopRight);
            planes[1].setFromCoplanarPoints(_vecNear, _vecTopRight, _vecDownRight);
            planes[2].setFromCoplanarPoints(_vecDownRight, _vecDownLeft, _vecNear);
            planes[3].setFromCoplanarPoints(_vecDownLeft, _vecTopLeft, _vecNear);
            planes[4].setFromCoplanarPoints(_vecTopRight, _vecDownRight, _vecDownLeft);
            planes[5].setFromCoplanarPoints(_vectemp3, _vectemp2, _vectemp1);
            planes[5].normal.multiplyScalar(- 1);
        } else if (isOrthographicCamera(this.camera)) {
            const left = Math.min(startPoint.x, endPoint.x);
            const top = Math.max(startPoint.y, endPoint.y);
            const right = Math.max(startPoint.x, endPoint.x);
            const down = Math.min(startPoint.y, endPoint.y);

            _vecTopLeft.set(left, top, - 1);
            _vecTopRight.set(right, top, - 1);
            _vecDownRight.set(right, down, - 1);
            _vecDownLeft.set(left, down, - 1);

            _vecFarTopLeft.set(left, top, 1);
            _vecFarTopRight.set(right, top, 1);
            _vecFarDownRight.set(right, down, 1);
            _vecFarDownLeft.set(left, down, 1);

            _vecTopLeft.unproject(this.camera);
            _vecTopRight.unproject(this.camera);
            _vecDownRight.unproject(this.camera);
            _vecDownLeft.unproject(this.camera);

            _vecFarTopLeft.unproject(this.camera);
            _vecFarTopRight.unproject(this.camera);
            _vecFarDownRight.unproject(this.camera);
            _vecFarDownLeft.unproject(this.camera);

            const planes = _frustum.planes;

            planes[0].setFromCoplanarPoints(_vecTopLeft, _vecFarTopLeft, _vecFarTopRight);
            planes[1].setFromCoplanarPoints(_vecTopRight, _vecFarTopRight, _vecFarDownRight);
            planes[2].setFromCoplanarPoints(_vecFarDownRight, _vecFarDownLeft, _vecDownLeft);
            planes[3].setFromCoplanarPoints(_vecFarDownLeft, _vecFarTopLeft, _vecTopLeft);
            planes[4].setFromCoplanarPoints(_vecTopRight, _vecDownRight, _vecDownLeft);
            planes[5].setFromCoplanarPoints(_vecFarDownRight, _vecFarTopRight, _vecFarTopLeft);
            planes[5].normal.multiplyScalar(- 1);
        } else {
            console.error('PointSelectionBox: Unsupported camera type.', this.camera);
        }
    }

    searchChildInFrustum(frustum: THREE.Frustum, object: THREE.Object3D) {
        if (isPoints(object)) {
            const geometry = object.geometry;
            const positionAttribute = geometry.getAttribute('position');
            let _vec3 = new THREE.Vector3();
            for (let i = 0; i < positionAttribute.count; i++) {
                _vec3.set(positionAttribute.getX(i), positionAttribute.getY(i), positionAttribute.getZ(i));
                if (frustum.containsPoint(_vec3)) {
                    if (!this.collection[object.id]) {
                        this.collection[object.id] = [i];
                    } else {
                        this.collection[object.id].push(i);
                    }
                }
            }
        }

        if (object.children.length > 0) {
            for (let x = 0; x < object.children.length; x++) {
                this.searchChildInFrustum(frustum, object.children[x]);
            }
        }
    }
}

// Type guards
function isOrthographicCamera(obj: any): obj is THREE.OrthographicCamera {
    return obj && obj.isOrthographicCamera;
}

function isPerspectiveCamera(obj: any): obj is THREE.PerspectiveCamera {
    return obj && obj.isPerspectiveCamera;
}

function isPoints(obj: any): obj is THREE.Points {
    return obj && obj.isPoints;
}

export { PointSelectionBox };
