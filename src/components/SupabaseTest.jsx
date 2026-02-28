import supabase from '../config/supabaseClient'
import { useEffect, useState } from 'react'

const SupabaseTest = () => {
  const [fetchError, setFetchError] = useState(null)
  const [ratings, setRatings] = useState(null)

  useEffect(() => {
    const fetchRatings = async() => {
      const { data, error} = await supabase
        .from('reviews')
        .select()

        console.log('data: ' + data)
        console.log('error: ' + error)

        if (error) {
          setFetchError('Could not fetch reviews')
          setRatings(null)
          console.log(error)
        }
        if (data) {
          setRatings(data)
          setFetchError(null)
        }
    }
    fetchRatings()
  }, [])

  return (
    <div className="supabase testing">
      <h2>TEST supabasetest</h2>
      <h3></h3>
      {fetchError && (<p>{fetchError}</p>)}
      {ratings && (
      <div className="ratings">
      {ratings.slice(0, 10).map((rating, index) => (
        <pre key={rating.id ?? index}>
          {JSON.stringify(rating, null, 2)}
        </pre>
      ))}
      </div>
      )}
    </div>
  )
}

export default SupabaseTest
