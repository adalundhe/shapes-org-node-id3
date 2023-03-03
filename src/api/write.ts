import { WriteTags } from "../types/Tags"
import { create }  from "./create"
import { removeTagsFromBuffer } from "./remove"
import { isFunction, isString } from "../util"

export type WriteCallback = {
    (error: null, data: Buffer): void
    (error: NodeJS.ErrnoException | Error, data: null): void
}

/**
 * Write passed tags to a file/buffer
 */
export function write(tags: WriteTags, buffer: ArrayBuffer): Buffer
export function write(
    tags: WriteTags, filebuffer: ArrayBuffer, callback: WriteCallback
): void
export function write(
    tags: WriteTags,
    filebuffer: ArrayBuffer,
    callback?: WriteCallback
): Buffer | true | Error | void {
    const tagsBuffer = create(tags)


    if (isFunction(callback)) {
        return callback(null, writeInBuffer(tagsBuffer, toBuffer(filebuffer)))
    }

    return writeInBuffer(tagsBuffer, toBuffer(filebuffer))
}

function writeInBuffer(tags: Buffer, buffer: Buffer) {
    buffer = removeTagsFromBuffer(buffer) || buffer
    return Buffer.concat([tags, buffer])
}


function toBuffer(arrayBuffer: ArrayBuffer): Buffer {

    const buffer = Buffer.alloc(arrayBuffer.byteLength);
    const view = new Uint8Array(arrayBuffer);
    for (let i = 0; i < buffer.length; ++i) {
      buffer[i] = view[i];
    }
    return buffer;
  }