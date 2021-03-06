/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package app.metatron.discovery.domain.mdm;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class MetadataPopularityService {

  @Autowired
  MetadataPopularityRepository popularityRepository;

  public Double getPopularityValue(String metadataId) {

    MetadataPopularity popularity = popularityRepository.findByTypeAndMetadataId(MetadataPopularity.PopularityType.METADATA, metadataId);

    return popularity == null ? 0.0 : popularity.getPopularity();
  }

  public Double getPopularityColumnValue(Long metaColumn) {

    MetadataPopularity popularity = popularityRepository.findByTypeAndMetaColumnId(MetadataPopularity.PopularityType.METACOLUMN, metaColumn);

    return popularity == null ? 0.0 : popularity.getPopularity();
  }
}
