import { getTagsFromBuffer } from '../TagsHelpers'
import { Tags, TagIdentifiers } from '../types/Tags'
import { Options } from '../types/Options'

export type ReadCallback = {
    (error: NodeJS.ErrnoException | Error, tags: null): void
    (error: null, tags: Tags | TagIdentifiers): void
}

/**
 * Read ID3-Tags from passed buffer/filepath
 */
export function read(
    filebuffer: Buffer,
    readOptions?: Options,
): Tags {
    const options: Options = readOptions ?? {};

    return getTagsFromBuffer(filebuffer, options)
}
