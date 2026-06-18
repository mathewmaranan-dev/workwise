const bcrypt = require('bcryptjs');
const hash = '$2b$10$2VoxOI8W4TCNUzwpU7eKrOnIOWnxgPJVtXjeL4QAV3R5vXx15SlIm';
const candidates = ['admin', 'password', 'workwise', 'Admin123!', 'admin@workwise.it.com', 'default', '123456', 'qwerty'];
(async () => {
  for (const p of candidates) {
    const ok = await bcrypt.compare(p, hash);
    console.log(p, ok);
  }
})();
