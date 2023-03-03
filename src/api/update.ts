import { WriteTags } from "../types/Tags"
import { Options } from "../types/Options"
import { read } from "./read"
import { updateTags } from '../updateTags'
import { write } from "./write"

/**
 * Update ID3-Tags from passed buffer/filepath
 */
export function update(
    tags: WriteTags,
    filebuffer: Buffer,
    updateOptions?: Options
): Buffer | true | Error | void {
;    const options: Options = updateOptions ?? {}

    const currentTags = read(filebuffer, options)
    const updatedTags = updateTags(tags, currentTags)

    return write(updatedTags, filebuffer)
}
