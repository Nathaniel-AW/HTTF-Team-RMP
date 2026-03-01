import {getReviewsFromLocalFile, summarizeReviews} from './server/index.js';  
(async()= 
const reviews = await getReviewsFromLocalFile('3126905');  
console.log('sample', reviews.slice(0,5).map(r= 
console.log('summ', await summarizeReviews(reviews));  
})();  
