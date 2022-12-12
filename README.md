# gcf-mfkey

Google Cloud Function for mfkey

## Example

```js
async function mfkey64 ({ uid, nt, nr, ar, at }) {
  const res = await fetch('https://mfkey-ybtjbo45iq-de.a.run.app/mfkey64', {
    body: JSON.stringify({ uid, nt, nr, ar, at }),
    cache: 'no-cache',
    headers: { 'content-type': 'application/json' },
    method: 'POST',
    mode: 'cors',
    redirect: 'follow',
    referrer: 'no-referrer',
  })
  return (await res.json())?.key
}
await mfkey64({
  uid: '65535d33',
  nt: '2c198be4',
  nr: 'fedac6d2',
  ar: 'cf0a3c7e',
  at: 'f4a81af8',
})
// 'A9AC67832330'
```
