import bcrypt

hash_value = '$2b$10$2VoxOI8W4TCNUzwpU7eKrOnIOWnxgPJVtXjeL4QAV3R5vXx15SlIm'
for candidate in ['admin', 'password', 'workwise', 'Admin123!', 'admin@workwise.it.com', 'default', '123456', 'qwerty']:
    print(candidate, bcrypt.checkpw(candidate.encode('utf-8'), hash_value.encode('utf-8')))
