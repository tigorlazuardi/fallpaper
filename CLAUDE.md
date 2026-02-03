Project ini adalah service untuk collect wallpaper dari berbagai sources tapi dengan kriteria-kriteria tertentu.

Kriteria-kriteria ini disebut dengan name `Device`.

Jadi `device` punya property seperti ini:

1. id (UUID v7)
2. enabled
3. Name (human readable)
4. slug (url friendly name)
5. Height
6. Width
7. Aspect Ratio Delta -- ini adalah aspect ratio range perbedaan yang diterima untuk sebuah wallpaper di assign ke device atau tidak. Misal 0.2 Aspect Ratio Delta berarti jika Height / Width ratio itu 0.98, maka menerima gambar yang punya aspect ratio 1.18 hingga 0.78
8. Min height -- Jika ada, resolusi height gambar dibawah ini tidak diterima
9. Max height -- jika ada, resolusi height gambar diatas ini tidak diterima
10. Min width -- jika ada, resolusi width gambar dibawah ini tidak diterima
11. Max width -- jika ada, resolusi width gambar diatas ini tidak diterima
12. Min filesize -- jika di set, filesize gambar dibawah ini ditolak
13. Max filesize -- jika di set, filesize gambar diatas ini ditolak.
14. NSFW -- 0 terima semua gambar, 1 nsfw image ditolak, 2 hanya menerima nsfw image.
15. updated at dan created at.
