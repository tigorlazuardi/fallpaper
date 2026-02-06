Project ini adalah service untuk collect wallpaper dari berbagai sources tapi dengan kriteria-kriteria tertentu.

# Code Quality

- Setelah perubahan code typecheck dan lint. Jika tool tidak ada, offer ke user untuk install tool tersebut, kalau bisa prefer yang dari npm registry.
- Jika ada test yang nyentuh code dirubah, run test tersebut.
- Pastikan fix linter info, warning, error, kalau make sense. Jika memang karena bisnis logic harus pakai flow tersebut, kasih ignore label di code biar tidak kena lagi.

# Coding FLow

- Jika mau commit dah push, pastikan code quality test dijalankan. Jika tidak nyambung fixing linter yang dirubah, maka fixing linter dibuat commit baru dari perubahan.
