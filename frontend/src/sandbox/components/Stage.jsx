/* SandboxTest.jsx
  *
  * AUTHOR(S): Mark Taylor, Samuel Barney, Justin Moua
  *
  * PURPOSE: Stage for the sandbox nodes. Handles creation of sandbox nodes as
  *          well.
  * 
  * NOTES:
  */

import React, { useImperativeHandle, forwardRef, useRef, useEffect, useState} from "react";
import {
    DatasetObject,
    DenseLayerObject,
    ActivationLayerObject,
    ConvolutionLayerObject,
    NeuronObject,
    OutputLayerObject,
    ReluObject,
    SigmoidObject,
    TanhObject,
    SoftmaxObject,
    ConvolutionLayer3x3Object,
    ConvolutionLayer5x5Object,
    ConvolutionLayer7x7Object
 } from './LayerObjects.jsx';
import StartNode from './StartNode.jsx';
import PlainDraggable from "plain-draggable";
import snapPoints from "../snapPoints.js";

//Stage is a component that handles the rendering and interaction of elements on a stage.
//SandboxTest.jsx uses this component~
//elements is passed in as a prop from SandboxTest.jsx
//and contains the following:
//  {
//      id: count,
//      objectType,
//      subType,
//      snapType
//  }
const Stage = forwardRef(({ elements, drags, setDrags, drawerOpen }, ref) => {
    const divRefs = useRef([]);
    const handleRefs = useRef([]);
    const drag = useRef([]);

    /*
    {   activeObjects object structure
        id: "object1", // Unique identifier
        element: div, // Reference to the DOM element
        leftLink: null, // Reference to the object snapped to the left
        rightLink: null, // Reference to the object snapped to the right
        snapPoints: [
            { type: "left", x: 100, y: 200 }, // Left snap point
            { type: "right", x: 300, y: 200 } // Right snap point
        ]
    }
    */

    const activeObjectsRef = useRef([]);
    const [activeObjectsState, setActiveObjectsState] = useState([]);


    // 2. Expose startNode and activeObjects via the ref
    useImperativeHandle(ref, () => ({
        getStartNode: () => activeObjectsRef.current.find(obj => obj.objectType === "startNode"),
        getActiveObjects: () => activeObjectsRef.current,
    }));

    // draggables do not know about state variables? so the need an external helper
    function extAction(ref) {
        console.log(`an element has called for external action: ${typeof ref}`);
    }
    
    useEffect(() => {
        //console.log("divRefs:", divRefs.current);
        //console.log("handleRefs:", handleRefs.current);

        // This useEffect runs after the components are rendered
        divRefs.current.forEach((div, index) => {
            if (!drag.current[index]) {
                drag.current[index] = 1;

                // Subscribe to mouse move event listener
                let mouse;
                addEventListener("mousemove", (event) => {mouse = event});
                
                // Create a new PlainDraggable instance
                const draggable = new PlainDraggable(div);

                // Get the type of the object from the elements array
                const snapType = elements[index]?.snapType || "all"; // Default to "all" if type is not specified   
                const objectType = elements[index]?.objectType || `object${index}`;   
                const subType = elements[index]?.subType || `subtype${index}`; // Subtype isn't used for snapping rules currently
                const newObject = createNewObject(objectType, subType, div, index, snapType);

                //console.log("Active Objects:", activeObjectsRef.current);

                // Define draggable behavior
                draggable.onMove = function () {
                    const currentObject = activeObjectsRef.current.find(obj => obj.element === div);
                    const snap = findClosestSnapPoint(currentObject, activeObjectsRef);

                    if (snap) {
                        const dx = snap.otherPoint.x - snap.currentPoint.x;
                        const dy = snap.otherPoint.y - snap.currentPoint.y;

                        // Move the draggable to the snap point
                        draggable.left += dx;
                        draggable.top += dy;

                        // Explicitly update the draggable's position
                        draggable.position();
                    }
                };

                draggable.onDragEnd = function () {
                    const currentObject = activeObjectsRef.current.find(obj => obj.element === div);
                    const snap = findClosestSnapPoint(currentObject, activeObjectsRef);
                    clearLinks(currentObject);

                    if (snap) {
                        updateLinks(currentObject, snap);
                        //console.log("Snapped:", currentObject, "to", snap.otherObject);
                    }

                    if (mouse.x < 250) {
                        // somehow remove this
                        console.error(`TODO: Implement despawning div!`);
                        
                        //extAction(divRefs[index]);
                    }

                };

                // Set initial position
                draggable.top = 300;
                draggable.left = 300;

                // Visually above everything for dragging into node drawer for deletion
                draggable.onDrag = function () {
                    draggable.zIndex = 99000;
                }

                // Set the handle
                draggable.handle = handleRefs.current[index];

                // Do not override the cursor
                draggable.draggableCursor = false;
                draggable.draggingCursor = false;

                // Add the draggable to the drag list
                setDrags(prev => [...prev, draggable]);
            }
        });
    }, [elements, setDrags]);

    function updateLinks(currentObject, snap) {
        const updatedObjects = activeObjectsRef.current.map(obj => {
            if (obj === currentObject) {
                if (snap.currentPoint.type === "left") {
                    obj.leftLink = snap.otherObject;
                    snap.otherObject.rightLink = obj;
                } else if (snap.currentPoint.type === "right") {
                    obj.rightLink = snap.otherObject;
                    snap.otherObject.leftLink = obj;
                } else if (snap.currentPoint.type === "top") {
                    obj.topLink = snap.otherObject;
                    snap.otherObject.bottomLink = obj;

                    // Set left and right links to 0 when snapping to the top
                    obj.leftLink = 0;
                    obj.rightLink = 0;
                } else if (snap.currentPoint.type === "bottom") {
                    obj.bottomLink = snap.otherObject;
                    snap.otherObject.topLink = obj;

                    // Set left and right links to 0 when snapping to the bottom
                    obj.leftLink = 0;
                    obj.rightLink = 0;
                }
            }
            return obj;
        });
    
        activeObjectsRef.current = updatedObjects; // Update the ref
        setActiveObjectsState(updatedObjects); // Trigger a re-render
    }

    function clearLinks(currentObject) {
        const updatedObjects = activeObjectsRef.current.map(obj => {
            if (obj === currentObject) {
                if (obj.leftLink) obj.leftLink.rightLink = null;
                if (obj.rightLink) obj.rightLink.leftLink = null;
                if (obj.topLink) obj.topLink.bottomLink = null;
                if (obj.bottomLink) obj.bottomLink.topLink = null;

                obj.leftLink = null;
                obj.rightLink = null;
                obj.topLink = null;
                obj.bottomLink = null;
            }
            return obj;
        });
    
        activeObjectsRef.current = updatedObjects; // Update the ref
        setActiveObjectsState(updatedObjects); // Trigger a re-render
    }
    // custom snapping behavior
    function findClosestSnapPoint(currentObject, activeObjectsRef) {
        if (!currentObject || !currentObject.element) {
            console.error("findClosestSnapPoint: currentObject or its element is undefined.");
            return null;
        }
    
        if (!currentObject.snapPoints) {
            console.error("findClosestSnapPoint: snapPoints is undefined for currentObject:", currentObject);
            return null;
        }
    
        // Cache the current object's bounding rect
        const currentRect = currentObject.element.getBoundingClientRect();
    
        // Dynamically calculate the current snap points
        const currentSnapPoints = currentObject.snapPoints
            .filter(point => {
                // Only consider snap points with null links
                return (point.type === "left" && !currentObject.leftLink) ||
                   (point.type === "right" && !currentObject.rightLink) ||
                   (point.type === "top" && !currentObject.topLink) ||
                   (point.type === "bottom" && !currentObject.bottomLink);
            })
            .map(point => ({
                type: point.type,
                x: point.type === "left" ? currentRect.left :
                   point.type === "right" ? currentRect.right :
                   currentRect.left + currentRect.width / 2, // For top and bottom, x is centered
                y: point.type === "top" ? currentRect.top :
                   point.type === "bottom" ? currentRect.bottom :
                   currentRect.top + currentRect.height / 2, // For left and right, y is centered
            }));
    
        let closestPoint = null;
        let minDistance = 50; // Max snap distance
    
        activeObjectsRef.current.forEach(otherObject => {
            if (otherObject === currentObject) return; // Skip the same object
    
            // Cache the other object's bounding rect
            const otherRect = otherObject.element.getBoundingClientRect();
    
            // Dynamically calculate the other object's snap points
            const otherSnapPoints = otherObject.snapPoints
            .filter(point => {
                // Only consider snap points with null links
                return (point.type === "left" && otherObject.leftLink == null) ||
                    (point.type === "right" && otherObject.rightLink == null) ||
                    (point.type === "top" && otherObject.topLink == null) ||
                    (point.type === "bottom" && otherObject.bottomLink == null);
            })
            .map(point => ({
                type: point.type,
                x: point.type === "left" ? otherRect.left :
                point.type === "right" ? otherRect.right :
                otherRect.left + otherRect.width / 2, // For top and bottom, x is centered
                y: point.type === "top" ? otherRect.top :
                point.type === "bottom" ? otherRect.bottom :
                otherRect.top + otherRect.height / 2, // For left and right, y is centered
            }));
    
            // Compare current snap points with other snap points
            currentSnapPoints.forEach(currentPoint => {
                otherSnapPoints.forEach(otherPoint => {
                    // Ensure valid snap points (left-to-right, right-to-left, top-to-bottom, bottom-to-top)
                    const isValidSnap =
                        (currentPoint.type === "left" && otherPoint.type === "right") ||
                        (currentPoint.type === "right" && otherPoint.type === "left") ||
                        (currentPoint.type === "top" && otherPoint.type === "bottom") ||
                        (currentPoint.type === "bottom" && otherPoint.type === "top");

                    if (isValidSnap) {
                        const distance = Math.hypot(currentPoint.x - otherPoint.x, currentPoint.y - otherPoint.y);
                        if (distance < minDistance) {
                            minDistance = distance;
                            closestPoint = { currentPoint, otherPoint, currentObject, otherObject };
                        }
                    }
                });
            });
        });
    
        return closestPoint;
    }

    function createNewObject(objectType, subType, div, index, snapType = "all") {
        const snapPoints = [];
    
        // Add snap points based on the shorthand type
        if (snapType === "all") {
            snapPoints.push({ type: "left" });
            snapPoints.push({ type: "right" });
            snapPoints.push({ type: "top" });
            snapPoints.push({ type: "bottom" });
        } else {
            if (snapType.includes("l")) snapPoints.push({ type: "left" });
            if (snapType.includes("r")) snapPoints.push({ type: "right" });
            if (snapType.includes("t")) snapPoints.push({ type: "top" });
            if (snapType.includes("b")) snapPoints.push({ type: "bottom" });
        }
    
        const newObject = {
            id: index,
            objectType: objectType,
            subType: subType,
            element: div,
            leftLink: null,
            rightLink: null,
            topLink: null,
            bottomLink: null,
            snapPoints,
        };
    
        const updatedObjects = [...activeObjectsRef.current, newObject];
        activeObjectsRef.current = updatedObjects; // Update the ref
        setActiveObjectsState(updatedObjects); // Trigger a re-render
        return newObject;
    }

    function renderObject(objectType, subType, props) {
        const { key, ...restProps } = props; // Extract the key from props
        const currentObject = activeObjectsState.find(obj => obj.id === props.name);

        const activeLinks = currentObject
        ? {
            top: currentObject.topLink !== null && currentObject.topLink !== 0 ? true : currentObject.topLink,
            right: currentObject.rightLink !== null && currentObject.rightLink !== 0 ? true : currentObject.rightLink,
            bottom: currentObject.bottomLink !== null && currentObject.bottomLink !== 0 ? true : currentObject.bottomLink,
            left: currentObject.leftLink !== null && currentObject.leftLink !== 0 ? true : currentObject.leftLink,
        }
        : { top: null, right: null, bottom: null, left: null }; // Default to null if no currentObject

        switch (objectType) {
            case "startNode":
                return <StartNode key={key} {...restProps} />;
            case "dataset":
                return <DatasetObject key={key} {...restProps} />;
            case "dense":
                return <DenseLayerObject key={key} {...restProps} />;
            case "activation":
                //return <ActivationLayerObject key={key} {...restProps} />;
                switch (subType) {
                    case "relu":
                        return <ReluObject key={key} {...restProps} />;
                    case "sigmoid":
                        return <SigmoidObject key={key} {...restProps} />;
                    case "tanh":
                        return <TanhObject key={key} {...restProps} />;
                    case "softmax":
                        return <SoftmaxObject key={key} {...restProps} />;
                }
            case "convolution":
                //return <ConvolutionLayerObject key={key} {...restProps} />;
                switch (subType) {
                    case "3x3":
                        return <ConvolutionLayer3x3Object key={key} {...restProps} />;
                    case "5x5":
                        return <ConvolutionLayer5x5Object key={key} {...restProps} />;
                    case "7x7":
                        return <ConvolutionLayer7x7Object key={key} {...restProps} />;
                }
            case "output":
                return <OutputLayerObject key={key} {...restProps} />;
            case "neuron":
                return <NeuronObject key={key} {...restProps} activeLinks={activeLinks} />;
            default:
                return null;
        }
    }

    return (
        <div id="stage" className="teststage">
            {elements.map((item, index) => (
                renderObject(item.objectType, item.subType,{
                    key: index,
                    name: item.id,
                    ref: (el) => (divRefs.current[index] = el),
                    handleRef: (el) => (handleRefs.current[index] = el),
                    action: extAction
                })
            ))}
        </div>
    );
});

export default Stage;
