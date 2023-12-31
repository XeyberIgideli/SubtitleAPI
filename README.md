﻿# Subtitle API

Subtitle API is a Node.js-based web service for retrieving subtitles from [OpenSubtitles.org](https://www.opensubtitles.org/). It provides API routes for searching movie and TV show subtitles, displaying subtitle data from subtitle pages, and even unzipping subtitle RAR files to read SRT files.

## Features

- 🎬 Search and retrieve subtitles for movies and TV shows.
- 📜 Display all data from subtitle pages with ease.
- 📦 Unzip subtitle RAR files and access SRT files effortlessly.
- 🚀 Flexible API routes for seamless integration into your projects.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
  - [Search for Movie Subtitles](#search-for-movie-subtitles)
  - [Read Movie SRT File](#read-movie-srt-file)
  - [Search for Show Subtitles](#search-for-show-subtitles)
  - [Read Show SRT File](#read-show-srt-file)
- [Contributing](#contributing)
- [License](#license) 

## Installation

1. **Clone this repository to your local machine:**

   ```bash
   git clone https://github.com/yourusername/subtitle-scraper.git
   
   cd subtitle-api

   npm install

## Usage
Unlock the power of Subtitle API through these intuitive API routes:

# Search for Movie Subtitles
route: api/search/movie/tur/Moviename

queries: 
- totalLink (how much subtitle will be scraped)
- lang (use comma for multiple language)

# Read Movie SRT File
route: api/movieName/lang/totLink/num/readMovieSubtitle

params:
- totalLink (how much subtitle will be scraped)
- num (nth subtitle from totalLink)

# Search for Show Subtitles
route: api/search/show/lang/showName

queries: 
- lang (use comma for multiple language)

# Read Show SRT File
route: api/showName/season/episode/lang/totLink/num/readShowSubtitle

params:
- season 
- episode
- totalLink (how much subtitle will be scraped)
- num (nth subtitle from totalLink)
# To do
- Fix character problems in reading srt file
## Contributing
We welcome contributions from the community! If you'd like to contribute to this project, please read our Contribution Guidelines and follow our Code of Conduct.

## License
This project is licensed under the MIT License - see the LICENSE file for details.
