# Nadam

Nadam is a Vinayaka Chavithi DJ song library built with Next.js, MongoDB Atlas, and GridFS. It includes a responsive listening page, search and category filters, an audio player, and a ZIP upload flow for adding a full collection.

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` in the project root:

```env
MONGODB_URI=your-mongodb-atlas-connection-string
MONGODB_DB=nadam
```

3. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`. The page shows a demo playlist until MongoDB is configured and contains uploaded songs.

## Upload songs

Use **Add songs** in the top navigation and choose a ZIP containing `.mp3`, `.wav`, `.m4a`, `.ogg`, or `.aac` files. Audio files are saved in the `audio.files` / `audio.chunks` GridFS collections, and searchable metadata is saved in the `songs` collection. Titles are generated from filenames, so name files clearly before uploading.

For the supplied RAR archive, run this from the project root on a machine that can reach Atlas:

```bash
npm run import:rar -- "C:\\Users\\chand\\Downloads\\DJ Songs @AiWithTarak_03.rar"
```

For immediate local playback when Atlas is unavailable, extract the archive into the app's public folder:

```bash
npm run extract:rar -- "C:\\Users\\chand\\Downloads\\DJ Songs @AiWithTarak_03.rar"
```

The Atlas user needs permission to read and write the `nadam` database. The connection string stays in `.env.local`, which is ignored by Git; never expose it in client-side code or commit it.

## Checks

```bash
npm run lint
npm run build
```
