## To-Do App (Next.js)

Simple single-page to-do app at `/` with:
- Add to-do (button or Enter key)
- Toggle complete
- Delete item
- Clear completed
- `localStorage` persistence
- Basic accessibility labels and button text
- Daily accomplishment trace based on tasks created today

## Run locally

Install dependencies (if needed):

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Usage checks

1. Add a task with text, press `Add` or `Enter`.
2. Empty/whitespace input is ignored.
3. Toggle checkbox to mark complete/incomplete.
4. Click `Delete` to remove one item.
5. Click `Clear completed` to remove all completed items.
6. Refresh the page to confirm tasks persist from `localStorage`.

## Scripts

- `npm run dev` - start development server
- `npm run build` - create production build
- `npm run start` - run production server
- `npm run lint` - run lint checks

## Implementation notes

- Main page: `app/page.tsx`
- To-do type:

```ts
type Todo = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
};
```
