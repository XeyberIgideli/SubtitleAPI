import express from 'express'
import axios from 'axios'
import cheerio from 'cheerio';


const router = express.Router()

// Search by lang
router.get('/search/:lang/:movieName', getMovie)
router.get('/api/:movieName/:lang/:totLink/:num/readSubtitle', readMovieSubtitle)

async function readMovieSubtitle(req,res) {
  const paramLang =  req.params.lang //req.query.lang.split('.')[0]
  try {
      if(paramLang) {
          const totalLink = req.params.totLink
          const movieName = req.params.movieName;
          const movieId = await getMovieId(movieName,paramLang);
          const movieData = await getSubtitleInfo(movieId,paramLang,totalLink) 
          const linkNum = movieData.downloadLinks.length <= req.params.num ? movieData.downloadLinks.length - 1 : req.params.num  
          const url = movieData.downloadLinks[linkNum].downloadLink.split('-')[1]
          const options =  { 
              method: 'GET',
              url,
              responseType: "arraybuffer"
          };
          const { data } = await axios(options);
          const zip = new admZip(data)
          const entries = zip.getEntries() 
          let srtFileStream = null 
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  
          for (const entry of entries) {
            if (entry.entryName.endsWith('.srt')) { 
              const buffer = entry.getData() 
              srtFileStream = Readable.from(buffer.toString('utf-8'))
              break
            }
          } 
          
          if(srtFileStream) {
              srtFileStream.pipe(res)
          } else {
              res.status(404).send('SRT file not found in the zip archive.')
          }
      } else {
          res.status(404).send('No subtitle found in this language!')
      }
      
  } catch (err) {
      console.log(err)
      res.status(500).send('Internal server error');
  }
}

async function getMovie (req, res) { 
    // @param url: api/tur/the-platform?totalLink=number

    let queryTotalLink = req.query.totalLink
    if(!queryTotalLink) {
        queryTotalLink = 3
    } 
    try {
      const paramLang = req.params.lang
      const movieName = req.params.movieName;
      const movieId = await getMovieId(movieName,paramLang);
      if (!movieId) {
        throw new Error('Movie not found');
      }
      
      const subtitleInfo = await getSubtitleInfo(movieId,paramLang,queryTotalLink); 
      res.json(subtitleInfo);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
}

async function getMovieId(movieName,lang,show) {
    const searchUrl = `https://www.opensubtitles.org/en/search2/sublanguageid-${lang}/moviename-${encodeURIComponent(
      movieName
    )}`;
    try {
      const searchResponse = await axios.get(searchUrl);
      const $ = cheerio.load(searchResponse.data);
      const movieLink = $('.bnone').attr('href'); 
      if (!movieLink) {
        return null;
      }
      
      const movieId = movieLink.match(/\/idmovie-(\d+)/);
      if (!movieId || movieId.length < 2) {
        return null;
      }
      
      return movieId[1];
    } catch (error) {
      throw new Error('Movie search failed');
    }
}
  
async function getSubtitleInfo(movieId,lang,totalLink) {
    const movieUrl = `https://www.opensubtitles.org/en/search/sublanguageid-${lang}/idmovie-${movieId}`
    try {
      const movieResponse = await axios.get(movieUrl)
      const $ = cheerio.load(movieResponse.data) 
      const singleDwLink = $('#bt-dwl-bt').attr('href')
      if(!singleDwLink) {
        let downloadPageLinks = [] 
        const index =  $('.msg h1').text().trim().split(' ').indexOf('subtitles')
        const title = lang.split(',').length > 1 ? $('.msg h1').text().trim().split(' ').slice(0,index).join(' ') : $('.msg h1').text().trim().split(' ').slice(0,-1).join(' ') 
        const language = lang.split(',').length > 1 ? $('.msg h1').text().trim().split(' ').slice(index+1).join(' ') : $('.msg h1').text().trim().split(' ').slice(-1).join(' ')
        const findLinks = $('.bnone').each((index,element) => {
          downloadPageLinks.push('https://www.opensubtitles.org' + element.attribs.href)
        });   
        if (!findLinks) {
          throw new Error('Download link not found')
        }   
        const downloadLinks = await Promise.all(downloadPageLinks.slice(0,totalLink).map(async (link) => await getDownloadLink(link)))
        return { title,pageLink:movieUrl,language, downloadLinks };
      } else {
        // For tv show page data
        return {downloadLinks:[{downloadLink: `${lang}-` + 'https://www.opensubtitles.org'+ singleDwLink}]}
      }
        
    } catch (error) { 
      throw new Error('Failed to fetch movie page')
    }
}

async function getDownloadLink(subtitlePageLink) {
    try {
      const subtitleResponse = await axios.get(subtitlePageLink);
      const $ = cheerio.load(subtitleResponse.data);
      const langShort = {
        en: 'eng',
        tr:'tur',
        ar:'ara',
        ru: 'rus'
      }
      const downloadLink = `${langShort[subtitlePageLink.slice(-2)]}-` + 'https://www.opensubtitles.org' + $('#bt-dwl-bt').attr('href'); 
      if (!downloadLink) {
        throw new Error('Download link not found');
      } 
      return {downloadLink };
    } catch (error) {
      throw new Error('Failed to fetch subtitle page');
    }
}

export default router