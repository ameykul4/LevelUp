-- Progress photos need an angle so "compare by angle" (§6e) can match
-- front-vs-front, not front-vs-side.
alter table progress_photos add column angle text default 'front';
