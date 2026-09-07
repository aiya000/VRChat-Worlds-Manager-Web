import { Schema } from '@effect/schema'

export const platformSchema = Schema.Literal(
  'standalonewindows',
  'android',
  'ios',
  'unknownplatform',
)

export const worldDisplayDataSchema = Schema.Struct({
  worldId: Schema.String,
  name: Schema.String,
  thumbnailUrl: Schema.String,
  authorName: Schema.String,
  favorites: Schema.Number,
  lastUpdated: Schema.String,
  visits: Schema.Number,
  dateAdded: Schema.String,
  platform: Schema.Array(platformSchema),
  folders: Schema.Array(Schema.String),
  tags: Schema.Array(Schema.String),
  capacity: Schema.Number,
})

export const folderDataSchema = Schema.Struct({
  name: Schema.String,
  world_count: Schema.Number,
})

export const backupMetaDataSchema = Schema.Struct({
  date: Schema.String,
  number_of_folders: Schema.Number,
  number_of_worlds: Schema.Number,
  app_version: Schema.String,
})

export const previousMetadataSchema = Schema.Struct({
  number_of_folders: Schema.Number,
  number_of_worlds: Schema.Number,
})

export const patreonDataSchema = Schema.Struct({
  platinumSupporter: Schema.Array(Schema.String),
  goldSupporter: Schema.Array(Schema.String),
  silverSupporter: Schema.Array(Schema.String),
  bronzeSupporter: Schema.Array(Schema.String),
  basicSupporter: Schema.Array(Schema.String),
})

export const worldBlacklistSchema = Schema.Struct({
  worlds: Schema.Array(Schema.String),
})

export const worldDetailsSchema = Schema.Struct({
  worldId: Schema.String,
  name: Schema.String,
  thumbnailUrl: Schema.String,
  authorName: Schema.String,
  authorId: Schema.String,
  favorites: Schema.Number,
  lastUpdated: Schema.String,
  visits: Schema.Number,
  platform: Schema.Array(platformSchema),
  description: Schema.String,
  tags: Schema.Array(Schema.String),
  capacity: Schema.Number,
  recommendedCapacity: Schema.NullOr(Schema.Number),
  publicationDate: Schema.NullOr(Schema.String),
  releaseStatus: Schema.Literal(
    'public',
    'private',
    'hidden',
    'all',
    'unknown',
  ),
})

export const backupDataSchema = Schema.Struct({
  metadata: backupMetaDataSchema,
  worlds: Schema.Array(worldDisplayDataSchema),
  folders: Schema.Array(folderDataSchema),
  hiddenWorlds: Schema.Array(Schema.String),
  memos: Schema.Record({ key: Schema.String, value: Schema.String }),
  customTags: Schema.Record({
    key: Schema.String,
    value: Schema.Array(Schema.String),
  }),
})
