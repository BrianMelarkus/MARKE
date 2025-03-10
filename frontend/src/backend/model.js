// model.js

import * as defaults from './defaults.js'

let model = null;
let sharedBuffer = null;
let weightArray = null;
let layerSizes = []; // Stores offsets for each layer's weights


export async function prepareModel(layers) {
    await tf.ready();  // Ensure TensorFlow.js is initialized
    model = tf.sequential();
    let firstLayer = true;

    for (let layer of layers) {
        if (layer.type === 'dense') {
        model.add(tf.layers.dense({
            units:      layer.units      || defaults.DENSE.units,
            activation: layer.activation || defaults.DENSE.activation,
            inputShape: firstLayer ? (layer.inputShape) : undefined
        }));
        }
        if (layer.type === 'conv2d') {
        model.add(tf.layers.conv2d({
            filters:    layer.filters    || defaults.CONV.units,
            kernelSize: layer.kernelSize || defaults.CONV.kernalSize,
            activation: layer.activation || defaults.CONV.activation,
            inputShape: layer.inputShape || defaults.CONV.inputShape,
            inputShape: firstLayer ? (layer.inputShape) : undefined
        }));
        }
        if (layer.type === 'dropout') {
        model.add(tf.layers.dropout({
            rate: layer.rate || defaults.DROPOUT.rate
        }));
        }
        firstLayer = false;
    }

    model.compile({
        loss: undefined      || defaults.COMPILE.loss,
        optimizer: undefined || defaults.COMPILE.optimizer
    });

    initSharedBuffer();
}


export async function trainModel(xs, ys, worker) {
    try {
        if (!model) {
            self.postMessage('Model not prepared. Please prepare model before training.');
            return;
        }
    
        await tf.ready();  // Ensure TensorFlow.js is initialized

        xs = tf.randomNormal([100, 1]);//test values
        ys = tf.randomNormal([100, 1]);//test values

        postMessage({ func: "sharedBuffer", args: {sharedBuffer, layerSizes }});

        await model.fit(xs, ys, {
            epochs: 500,
            callbacks: {
            onEpochEnd: (epoch, logs) => {
                worker.postMessage(`Epoch ${epoch + 1}: loss = ${logs.loss}`);
                saveWeightsToSharedMemory();
            }
            }
        });
  
        worker.postMessage('Training complete!');
    } catch (error) {
        worker.postMessage(`Error during training: ${error.message}`);
    }
  }


function initSharedBuffer(){
    const bufferSize = calculateBufferSize();
    sharedBuffer = new SharedArrayBuffer(bufferSize);
    weightArray = new Float32Array(sharedBuffer);
}

function calculateBufferSize() {
    let totalParams = 0;
    layerSizes = model.layers.map(layer => {
        let layerParams = layer.getWeights().reduce((sum, tensor) => sum + tensor.size, 0);
        totalParams += layerParams;
        return layerParams;
    });

    return totalParams * 4; // 4 bytes per float32
}

function saveWeightsToSharedMemory() {
    let offset = 0;
    model.layers.forEach((layer, layerIndex) => {
        layer.getWeights().forEach(tensor => {
            const data = tensor.dataSync();
            weightArray.set(data, offset);
            offset += data.length;
        });
    });

    postMessage({ func: "weightsUpdated" });
}
