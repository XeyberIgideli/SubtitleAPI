import express from 'express'

const router = express.Router()

router.get('/api/:lang/:movieName', getMovie);

async function getMovie (req, res) { 
    // api/tur/the-platform?totalLink=number

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