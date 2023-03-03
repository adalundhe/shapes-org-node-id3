import * as ID3Util from "../ID3Util"

/**
 * Remove already written ID3-Frames from a buffer
 */
export function removeTagsFromBuffer(data: Buffer) {
    const tagPosition = ID3Util.getTagPosition(data)

    if (tagPosition === -1) {
        return data
    }

    const tagHeaderSize = 10
    const encodedSize = data.subarray(
        tagPosition + 6,
        tagPosition + tagHeaderSize
    )
    if (!ID3Util.isValidEncodedSize(encodedSize)) {
        return false
    }

    if (data.length >= tagPosition + tagHeaderSize) {
        const size = ID3Util.decodeSize(encodedSize)
        return Buffer.concat([
            data.subarray(0, tagPosition),
            data.subarray(tagPosition + size + tagHeaderSize)
        ])
    }

    return data
}

export type RemoveCallback =
    (error: NodeJS.ErrnoException | Error | null) => void
