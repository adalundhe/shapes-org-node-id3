import { WriteTags } from "../types/Tags";
import { create }  from "./create";
import { removeTagsFromBuffer } from "./remove";
import * as NodeBuffer from 'buffer';

export type WriteCallback = {
    (error: null, data: Buffer): void
    (error: NodeJS.ErrnoException | Error, data: null): void
}

/**
 * Write passed tags to a file/buffer
 */
export function write(
    tags: WriteTags,
    filebuffer: ArrayBuffer
): Buffer | true | Error | void {
    const tagsBuffer = create(tags)
    return writeInBuffer(tagsBuffer, NodeBuffer.Buffer.from(filebuffer))
}

function writeInBuffer(tags: Buffer, buffer: Buffer) {
    buffer = removeTagsFromBuffer(buffer) || buffer
    return Buffer.concat([tags, buffer])
}

