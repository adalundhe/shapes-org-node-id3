import { FrameBuilder } from "./FrameBuilder"
import { FrameReader } from "./FrameReader"
import { APIC_TYPES } from './definitions/PictureTypes'
import { TagConstants } from './definitions/TagConstants'
import * as ID3Util from "./ID3Util"
import * as TagsHelpers from './TagsHelpers'
import { isString } from './util'
import { TextEncoding } from './definitions/Encoding'

// TODO: Fix with better types.
// eslint-disable-next-line
type Data = any

export const GENERIC_TEXT = {
    create: (frameIdentifier: string, data: Data) => {
        if(!frameIdentifier || !data) {
            return null
        }

        return new FrameBuilder(frameIdentifier)
            .appendNumber(0x01, 0x01)
            .appendValue(data, null, TextEncoding.UTF_16_WITH_BOM)
            .getBuffer()
    },
    read: (buffer: Buffer) => {
        const reader = new FrameReader(buffer, 0)

        return reader.consumeStaticValue('string')
    }
}

export const GENERIC_URL = {
    create: (frameIdentifier: string, data: Data) => {
        if(!frameIdentifier || !data) {
            return null
        }

        return new FrameBuilder(frameIdentifier)
            .appendValue(data)
            .getBuffer()
    },
    read: (buffer: Buffer) => {
        const reader = new FrameReader(buffer)

        return reader.consumeStaticValue('string')
    }
}

const APIC = {
    create: (data: Data) => {
        try {
            if (data instanceof Buffer) {
                data = {
                    imageBuffer: Buffer.from(data)
                }
            } else if (!data.imageBuffer) {
                return Buffer.alloc(0)
            }

            let mime_type = data.mime

            if(!mime_type) {
                mime_type = ID3Util.getPictureMimeTypeFromBuffer(data.imageBuffer)
            }

            const pictureType = data.type || {}
            const pictureTypeId = pictureType.id === undefined
                ? TagConstants.AttachedPicture.PictureType.FRONT_COVER
                : pictureType.id

            /*
             * Fix a bug in iTunes where the artwork is not recognized when the description is empty using UTF-16.
             * Instead, if the description is empty, use encoding 0x00 (ISO-8859-1).
             */
            const { description = '' } = data
            const encoding = description ?
                TextEncoding.UTF_16_WITH_BOM : TextEncoding.ISO_8859_1
            return new FrameBuilder('APIC')
              .appendNumber(encoding, 1)
              .appendNullTerminatedValue(mime_type)
              .appendNumber(pictureTypeId, 1)
              .appendNullTerminatedValue(description, encoding)
              .appendValue(data.imageBuffer)
              .getBuffer()
        } catch(error) {
            return null
        }
    },
    read: (buffer: Buffer, version: number) => {
        const reader = new FrameReader(buffer, 0)
        let mime
        if(version === 2) {
            mime = reader.consumeStaticValue('string', 3, 0x00)
        } else {
            mime = reader.consumeNullTerminatedValue('string', 0x00)
        }

        const typeId = reader.consumeStaticValue('number', 1)
        const description = reader.consumeNullTerminatedValue('string')
        const imageBuffer = reader.consumeStaticValue()

        return {
            mime: mime,
            type: {
                id: typeId,
                name: APIC_TYPES[typeId]
            },
            description: description,
            imageBuffer: imageBuffer
        }
    }
}

const COMM = {
    create: (data: Data) => {
        data = data || {}
        if(!data.text) {
            return null
        }

        return new FrameBuilder("COMM")
            .appendNumber(0x01, 1)
            .appendValue(data.language)
            .appendNullTerminatedValue(data.shortText, 0x01)
            .appendValue(data.text, null, 0x01)
            .getBuffer()
    },
    read: (buffer: Buffer) => {
        const reader = new FrameReader(buffer, 0)

        return {
            language: reader.consumeStaticValue('string', 3, 0x00),
            shortText: reader.consumeNullTerminatedValue('string'),
            text: reader.consumeStaticValue('string', null)
        }
    }
}

const USLT = {
    create: (data: Data) => {
        data = data || {}
        if(isString(data)) {
            data = {
                text: data
            }
        }
        if(!data.text) {
            return null
        }

        return new FrameBuilder("USLT")
            .appendNumber(0x01, 1)
            .appendValue(data.language)
            .appendNullTerminatedValue(data.shortText, 0x01)
            .appendValue(data.text, null, 0x01)
            .getBuffer()
    },
    read: (buffer: Buffer) => {
        const reader = new FrameReader(buffer, 0)

        return {
            language: reader.consumeStaticValue('string', 3, 0x00),
            shortText: reader.consumeNullTerminatedValue('string'),
            text: reader.consumeStaticValue('string', null)
        }
    }
}

const SYLT = {
    create: (data: Data) => {
        if(!(data instanceof Array)) {
            data = [data]
        }

        const encoding = 1 // 16 bit unicode
        return Buffer.concat(data.map((lycics: Data) => {
            const frameBuilder = new FrameBuilder("SYLT")
                .appendNumber(encoding, 1)
                .appendValue(lycics.language, 3)
                .appendNumber(lycics.timeStampFormat, 1)
                .appendNumber(lycics.contentType, 1)
                .appendNullTerminatedValue(lycics.shortText, encoding)
            lycics.synchronisedText.forEach((part: Data) => {
                frameBuilder.appendNullTerminatedValue(part.text, encoding)
                frameBuilder.appendNumber(part.timeStamp, 4)
            })
            return frameBuilder.getBuffer()
        }))
    },
    read: (buffer: Buffer) => {
        const reader = new FrameReader(buffer, 0)

        return {
            language: reader.consumeStaticValue('string', 3, 0x00),
            timeStampFormat: reader.consumeStaticValue('number', 1),
            contentType: reader.consumeStaticValue('number', 1),
            shortText: reader.consumeNullTerminatedValue('string'),
            synchronisedText: Array.from((function*() {
                while(true) {
                    const text = reader.consumeNullTerminatedValue('string')
                    const timeStamp = reader.consumeStaticValue('number', 4)
                    if (text === undefined || timeStamp === undefined) {
                        break
                    }
                    yield {text, timeStamp}
                }
            })())
        }
    }
}

const TXXX = {
    create: (data: Data) => {
        if(!(data instanceof Array)) {
            data = [data]
        }

        return Buffer.concat(data.map((udt: Data) => new FrameBuilder("TXXX")
            .appendNumber(0x01, 1)
            .appendNullTerminatedValue(udt.description, 0x01)
            .appendValue(udt.value, null, 0x01)
            .getBuffer()))
    },
    read: (buffer: Buffer) => {
        const reader = new FrameReader(buffer, 0)

        return {
            description: reader.consumeNullTerminatedValue('string'),
            value: reader.consumeStaticValue('string')
        }
    }
}

const POPM = {
    create: (data: Data) => {
        const email = data.email
        let rating = Math.trunc(data.rating)
        let counter = Math.trunc(data.counter)
        if(!email) {
            return null
        }
        if(isNaN(rating) || rating < 0 || rating > 255) {
            rating = 0
        }
        if(isNaN(counter) || counter < 0) {
            counter = 0
        }

        return new FrameBuilder("POPM")
            .appendNullTerminatedValue(email)
            .appendNumber(rating, 1)
            .appendNumber(counter, 4)
            .getBuffer()
    },
    read: (buffer: Buffer) => {
        const reader = new FrameReader(buffer)
        return {
            email: reader.consumeNullTerminatedValue('string'),
            rating: reader.consumeStaticValue('number', 1),
            counter: reader.consumeStaticValue('number')
        }
    }
}

const PRIV = {
    create: (data: Data) => {
        if(!(data instanceof Array)) {
            data = [data]
        }

        return Buffer.concat(data.map((priv: Data) => new FrameBuilder("PRIV")
            .appendNullTerminatedValue(priv.ownerIdentifier)
            .appendValue(priv.data instanceof Buffer ? priv.data : Buffer.from(priv.data, "utf8"))
            .getBuffer()))
    },
    read: (buffer: Buffer) => {
        const reader = new FrameReader(buffer)
        return {
            ownerIdentifier: reader.consumeNullTerminatedValue('string'),
            data: reader.consumeStaticValue()
        }
    }
}

const UFID = {
    create: (data: Data) => {
        if (!(data instanceof Array)) {
            data = [data]
        }

        return Buffer.concat(data.map((ufid: Data) => new FrameBuilder("UFID")
            .appendNullTerminatedValue(ufid.ownerIdentifier)
            .appendValue(
                ufid.identifier instanceof Buffer ?
                ufid.identifier : Buffer.from(ufid.identifier, "utf8")
            )
            .getBuffer()))
    },
    read: (buffer: Buffer) => {
        const reader = new FrameReader(buffer)
        return {
            ownerIdentifier: reader.consumeNullTerminatedValue('string'),
            identifier: reader.consumeStaticValue()
        }
    }
}

const CHAP = {
    create: (data: Data) => {
        if (!(data instanceof Array)) {
            data = [data]
        }

        return Buffer.concat(data.map((chap: Data) => {
            if (!chap || !chap.elementID || typeof chap.startTimeMs === "undefined" || !chap.endTimeMs) {
                return null
            }
            const getOffset = (offset?: number) => offset ?? 0xFFFFFFFF
            return new FrameBuilder("CHAP")
                .appendNullTerminatedValue(chap.elementID)
                .appendNumber(chap.startTimeMs, 4)
                .appendNumber(chap.endTimeMs, 4)
                .appendNumber(getOffset(chap.startOffsetBytes), 4)
                .appendNumber(getOffset(chap.endOffsetBytes), 4)
                .appendValue(TagsHelpers.createBufferFromTags(chap.tags))
                .getBuffer()
        }).filter((chap: Data) => chap instanceof Buffer))
    },
    read: (buffer: Buffer) => {
        const reader = new FrameReader(buffer)

        const consumeNumber = () => reader.consumeStaticValue('number', 4)

        const makeOffset = (value: number) => value === 0xFFFFFFFF ? null : value

        const elementID = reader.consumeNullTerminatedValue('string')
        const startTimeMs = consumeNumber()
        const endTimeMs = consumeNumber()
        const startOffsetBytes = makeOffset(consumeNumber())
        const endOffsetBytes = makeOffset(consumeNumber())
        const tags = TagsHelpers.getTagsFromTagBody(reader.consumeStaticValue())
        return {
            elementID,
            startTimeMs,
            endTimeMs,
            ...startOffsetBytes === null ? {} : {startOffsetBytes},
            ...endOffsetBytes === null ? {} : {endOffsetBytes},
            tags
        }
    }
}

const CTOC = {
    create: (data: Data) => {
        if(!(data instanceof Array)) {
            data = [data]
        }

        return Buffer.concat(data.map((toc: Data, index: Data) => {
            if(!toc || !toc.elementID) {
                return null
            }
            if(!(toc.elements instanceof Array)) {
                toc.elements = []
            }

            const ctocFlags = Buffer.alloc(1, 0)
            if(index === 0) {
                ctocFlags[0] += 2
            }
            if(toc.isOrdered) {
                ctocFlags[0] += 1
            }

            const builder = new FrameBuilder("CTOC")
                .appendNullTerminatedValue(toc.elementID)
                .appendValue(ctocFlags, 1)
                .appendNumber(toc.elements.length, 1)
            toc.elements.forEach((el: Data) => {
                builder.appendNullTerminatedValue(el)
            })
            if(toc.tags) {
                builder.appendValue(TagsHelpers.createBufferFromTags(toc.tags))
            }
            return builder.getBuffer()
        }).filter((toc: Data) => toc instanceof Buffer))
    },
    read: (buffer: Buffer) => {
        const reader = new FrameReader(buffer)
        const elementID = reader.consumeNullTerminatedValue('string')
        const flags = reader.consumeStaticValue('number', 1)
        const entries = reader.consumeStaticValue('number', 1)
        const elements = []
        for(let i = 0; i < entries; i++) {
            elements.push(reader.consumeNullTerminatedValue('string'))
        }
        const tags = TagsHelpers.getTagsFromTagBody(reader.consumeStaticValue())

        return {
            elementID,
            isOrdered: !!(flags & 0x01),
            elements,
            tags
        }
    }
}

const WXXX = {
    create: (data: Data) => {
        if(!(data instanceof Array)) {
            data = [data]
        }

        return Buffer.concat(data.map((udu: Data) => {
            return new FrameBuilder("WXXX")
                .appendNumber(0x01, 1)
                .appendNullTerminatedValue(udu.description, 0x01)
                .appendValue(udu.url, null)
                .getBuffer()
        }))
    },
    read: (buffer: Buffer) => {
        const reader = new FrameReader(buffer, 0)

        return {
            description: reader.consumeNullTerminatedValue('string'),
            url: reader.consumeStaticValue('string', null, 0x00)
        }
    }
}

const ETCO = {
    create: (data: Data) => {
        const builder = new FrameBuilder("ETCO")
            .appendNumber(data.timeStampFormat, 1)
        data.keyEvents.forEach((keyEvent: Data) => {
            builder
                .appendNumber(keyEvent.type, 1)
                .appendNumber(keyEvent.timeStamp, 4)
        })

        return builder.getBuffer()
    },
    read: (buffer: Buffer) => {
        const reader = new FrameReader(buffer)

        return {
            timeStampFormat: reader.consumeStaticValue('number', 1),
            keyEvents: Array.from((function*() {
                while(true) {
                    const type = reader.consumeStaticValue('number', 1)
                    const timeStamp = reader.consumeStaticValue('number', 4)
                    if (type === undefined || timeStamp === undefined) {
                        break
                    }
                    yield {type, timeStamp}
                }
            })())
        }
    }
}

const COMR = {
    create: (data: Data) => {
        if(!(data instanceof Array)) {
            data = [data]
        }

        return Buffer.concat(data.map((comr: Data) => {
            const prices = comr.prices || {}
            const builder = new FrameBuilder("COMR")

            // Text encoding
            builder.appendNumber(0x01, 1)
            // Price string
            const priceString = Object.entries(prices).map((price: Data) => {
                return price[0].substring(0, 3) + price[1].toString()
            }).join('/')
            builder.appendNullTerminatedValue(priceString, 0x00)
            // Valid until
            builder.appendValue(
                comr.validUntil.year.toString().padStart(4, '0').substring(0, 4) +
                comr.validUntil.month.toString().padStart(2, '0').substring(0, 2) +
                comr.validUntil.day.toString().padStart(2, '0').substring(0, 2),
                8, 0x00
            )
            // Contact URL
            builder.appendNullTerminatedValue(comr.contactUrl, 0x00)
            // Received as
            builder.appendNumber(comr.receivedAs, 1)
            // Name of seller
            builder.appendNullTerminatedValue(comr.nameOfSeller, 0x01)
            // Description
            builder.appendNullTerminatedValue(comr.description, 0x01)
            // Seller logo
            if(comr.sellerLogo) {
                const pictureFilenameOrBuffer = comr.sellerLogo.picture
                const picture = pictureFilenameOrBuffer

                let mimeType = comr.sellerLogo.mimeType || ID3Util.getPictureMimeTypeFromBuffer(picture)

                // Only image/png and image/jpeg allowed
                if (mimeType !== 'image/png' && 'image/jpeg') {
                    mimeType = 'image/'
                }

                builder.appendNullTerminatedValue(mimeType || '', 0x00)
                builder.appendValue(picture)
            }
            return builder.getBuffer()
        }))
    },
    read: (buffer: Buffer) => {
        const reader = new FrameReader(buffer, 0)

        const tag: Data = {}

        // Price string
        const priceStrings = reader.consumeNullTerminatedValue('string', 0x00)
            .split('/')
            .filter((price) => price.length > 3)
        tag.prices = {}
        for(const price of priceStrings) {
            tag.prices[price.substring(0, 3)] = price.substring(3)
        }
        // Valid until
        const validUntilString = reader.consumeStaticValue('string', 8, 0x00)
        tag.validUntil = { year: 0, month: 0, day: 0 }
        if(/^\d+$/.test(validUntilString)) {
            tag.validUntil.year = parseInt(validUntilString.substring(0, 4))
            tag.validUntil.month = parseInt(validUntilString.substring(4, 6))
            tag.validUntil.day = parseInt(validUntilString.substring(6))
        }
        // Contact URL
        tag.contactUrl = reader.consumeNullTerminatedValue('string', 0x00)
        // Received as
        tag.receivedAs = reader.consumeStaticValue('number', 1)
        // Name of seller
        tag.nameOfSeller = reader.consumeNullTerminatedValue('string')
        // Description
        tag.description = reader.consumeNullTerminatedValue('string')
        // Seller logo
        const mimeType = reader.consumeNullTerminatedValue('string', 0x00)
        const picture = reader.consumeStaticValue('buffer')
        if(picture && picture.length > 0) {
            tag.sellerLogo = {
                mimeType,
                picture
            }
        }

        return tag
    }
}

export const Frames = {
    APIC,
    COMM,
    USLT,
    SYLT,
    TXXX,
    POPM,
    PRIV,
    UFID,
    CHAP,
    CTOC,
    WXXX,
    ETCO,
    COMR
}
