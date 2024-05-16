var scene = null;
var maxDepth = 1;
var background_color = [190/255, 210/255, 215/255];
var ambientToggle = true;
var diffuseToggle = true;
var specularToggle = true;
var reflectionToggle = true;
var bias = 0.001;

class Ray {
    constructor(origin, direction) {
        this.origin = origin;
        this.direction = direction;
    }
}

class Intersection {
    constructor(distance, point) {
        this.distance = distance;
        this.point = point;
    }
}

class Hit {
    constructor(intersection, object) {
        this.intersection = intersection;
        this.object = object;
    }
}

/*
    Intersect objects
*/
function raySphereIntersection(ray, sphere) {
    var center = sphere.center;
    var radius = sphere.radius;

    // Compute intersection
    var light = sub(ray.origin, center);
    var A = dot(ray.direction, ray.direction);
    var B = 2 * dot(ray.direction, light);
    var C = dot(light, light) - Math.pow(radius, 2);
    var discriminant = Math.pow(B, 2) - 4 * A * C;

    // If there is a intersection, return a new Intersection object with the distance and intersection point:
    // E.g., return new Intersection(t, point);
    if (discriminant == 0) {
        var T = -B / 2 * A;
        var P = add(ray.origin, mult(ray.direction, T));

        if (T <= 0) {
            return null;
        }

        P = sub(P, mult(ray.direction, bias));

        return new Intersection(T, P);
    } else if (discriminant > 0) {
        var P, R;

        var r1 = (-B + Math.sqrt(discriminant)) / (2 * A);
        var r2 = (-B - Math.sqrt(discriminant)) / (2 * A);
        
        if (r1 <= 0 || r2 <= 0) {
            return null;
        }

        var p1 = add(ray.origin, mult(ray.direction, r1));
        var p2 = add(ray.origin, mult(ray.direction, r2));

        P = p1 > p2 ? p2 : p1;
        R = p1 > p2 ? r1 : r2;

        P = sub(P, mult(ray.direction, bias));

        return new Intersection(R, P);
    } else {
        // If no intersection, return null
        return null;
    }

}

function rayPlaneIntersection(ray, plane) {

    // Compute intersection
    var pOrigin = plane.center;
    var origin = ray.origin;
    var direction = ray.direction;
    var normalized = normalize(plane.normal);

    // If there is a intersection, return a dictionary with the distance and intersection point:
    // E.g., return new Intersection(t, point);
    if (!dot(normalized, direction) == 0) {
        var T = dot(sub(pOrigin, origin), normalized) / dot(normalized, direction);
        if (T <= 0) {
            return 0;
        }

        var P = add(origin, mult(direction, T));
        P = sub(P, mult(ray.direction, bias));

        return new Intersection(T, P)
    } else {
        return null;
    }

    // If no intersection, return null

}

function intersectObjects(ray, depth) {
    // Loop through all objects, compute their intersection (based on object type and calling the previous two functions)
    // Return a new Hit object, with the closest intersection and closest object
    var close = new Hit(new Intersection(Infinity, Infinity), null);
    for (var i = 0; i < scene.objects.length; i++) {
        var object = scene.objects[i];
        var curIntersection = null;

        if (object.type == 'sphere') {
            curIntersection = raySphereIntersection(ray, object);
        } else if (object.type == 'plane') {
            curIntersection = rayPlaneIntersection(ray, object);
        }
        if (curIntersection != null && curIntersection.distance < close.intersection.distance) {
            close = new Hit(curIntersection, object);
        }
    }

    // If no hit, retur null
    if (close.object == null) {
        return null;
    } else {
        return close;
    }
}

function sphereNormal(sphere, pos) {
    // Return sphere normal
    return normalize(sub(pos, sphere.center));
}

/*
    Shade surface
*/
function shade(ray, hit, depth) {

    var object = hit.object;
    var color = [0,0,0];
    
    
    // Compute object normal, based on object type
    // If sphere, use sphereNormal, if not then it's a plane, use object normal
    var normal;

    if (object.type == "sphere") {
        normal = sphereNormal(object, hit.intersection.point);
    } else if (object.type == "plane") {
        normal = normalize(object.normal);
    }

    // Loop through all lights, computing diffuse and specular components *if not in shadow*
    var diffuse = 0;
    var specular = 0;

    for (var i = 0; i < scene.lights.length; i++) {
        var light = scene.lights[i];
        var lightDirection = normalize(sub(light.position, hit.intersection.point));
        var normalized = normalize(add(lightDirection, mult(ray.direction, -1)));

        if (!isInShadow(hit.intersection.point, light.position)) {
            diffuse += object.diffuseK * dot(lightDirection, normal);
            specular += object.specularK * Math.pow(dot(normalized, normal), object.specularExponent);
        }
        var total = 0;
    }

    // Combine colors, taking into account object constants
    // Handle reflection, make sure to call trace incrementing depth
    var enhancement = 1;

    if (ambientToggle == true) {
        total += object.ambientK * enhancement;
    }

    if (diffuseToggle == true) {
        total += diffuse * enhancement;
    }

    if (specularToggle == true) {
        total += specular * enhancement;
    }

    color = add(color, mult(object.color, total));

    if (depth < maxDepth && reflectionToggle == true) {
        var refRay = mult(ray.direction, -1);
        var refDirect = mult(normal, dot(refRay, normal));
        var reflectDir = normalize(sub(mult(refDirect, 2), refRay));
        var reflectRay = new Ray(hit.intersection.point, reflectDir);
        var reflectColor = trace(reflectRay, depth + 1);
        if (reflectColor == null) {
            return color;
        } else {
            return add(color, mult(reflectColor, object.reflectiveK));
        }
    }

    return color;
}


/*
    Trace ray
*/
function trace(ray, depth) {
    if (depth > maxDepth) return background_color;
    var hit = intersectObjects(ray, depth);
    if (hit != null) {
        var color = shade(ray, hit, depth);
        return color;
    }
    return null;
}

function isInShadow(hit, light) {

    // Check if there is an intersection between the hit.intersection.point point and the light
    // If so, return true
    // If not, return false
    var direction = normalize(sub(light, hit));
    var ray = new Ray(hit, direction);
    var intersection = intersectObjects(ray, 1);

    if (intersection != null && intersection.intersection.distance > 0) {
        return true;
    } else {
        return false;
    }
}

/*
    Render loop
*/
function render(element) {
    if(scene == null)
        return;
    
    var width = element.clientWidth;
    var height = element.clientHeight;
    element.width = width;
    element.height = height;
    scene.camera.width = width;
    scene.camera.height = height;

    var ctx = element.getContext("2d");
    var data = ctx.getImageData(0, 0, width, height);

    var eye = normalize(sub(scene.camera.direction,scene.camera.position));
    var right = normalize(cross(eye, [0,1,0]));
    var up = normalize(cross(right, eye));
    var fov = ((scene.camera.fov / 2.0) * Math.PI / 180.0);

    var halfWidth = Math.tan(fov);
    var halfHeight = (scene.camera.height / scene.camera.width) * halfWidth;
    var pixelWidth = (halfWidth * 2) / (scene.camera.width - 1);
    var pixelHeight = (halfHeight * 2) / (scene.camera.height - 1);

    for(var x=0; x < width; x++) {
        for(var y=0; y < height; y++) {
            var vx = mult(right, x*pixelWidth - halfWidth);
            var vy = mult(up, y*pixelHeight - halfHeight);
            var direction = normalize(add(add(eye,vx),vy));
            var origin = scene.camera.position;

            var ray = new Ray(origin, direction);
            var color = trace(ray, 0);
            if(color != null) {
                var index = x * 4 + y * width * 4;
                data.data[index + 0] = color[0];
                data.data[index + 1] = color[1];
                data.data[index + 2] = color[2];
                data.data[index + 3] = 255;
            }
        }
    }
    console.log("done");
    ctx.putImageData(data, 0, 0);
}

/*
    Handlers
*/
window.handleFile = function(e) {
    var reader = new FileReader();
    reader.onload = function(evt) {
        var parsed = JSON.parse(evt.target.result);
        scene = parsed;
    }
    reader.readAsText(e.files[0]);
}

window.updateMaxDepth = function() {
    maxDepth = document.querySelector("#maxDepth").value;
    var element = document.querySelector("#canvas");
    render(element);
}

window.toggleAmbient = function() {
    ambientToggle = document.querySelector("#ambient").checked;
    var element = document.querySelector("#canvas");
    render(element);
}

window.toggleDiffuse = function() {
    diffuseToggle = document.querySelector("#diffuse").checked;
    var element = document.querySelector("#canvas");
    render(element);
}

window.toggleSpecular = function() {
    specularToggle = document.querySelector("#specular").checked;
    var element = document.querySelector("#canvas");
    render(element);
}

window.toggleReflection = function() {
    reflectionToggle = document.querySelector("#reflection").checked;
    var element = document.querySelector("#canvas");
    render(element);
}

/*
    Render scene
*/
window.renderScene = function(e) {
    var element = document.querySelector("#canvas");
    render(element);
}